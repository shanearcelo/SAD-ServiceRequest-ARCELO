# Systems Analysis and Design — Laboratory 3 & 4
**ICT Service Request System with Role-Based Access Control & Auditing**

* **GitHub Repository URL:** [https://github.com/shanearcelo/SAD-ServiceRequest-ARCELO](https://github.com/shanearcelo/SAD-ServiceRequest-ARCELO)
* **Live GitHub Pages URL:** [https://shanearcelo.github.io/SAD-ServiceRequest-ARCELO/login.html](https://shanearcelo.github.io/SAD-ServiceRequest-ARCELO/login.html)

---

## System Overview
This project is an integrated web-based ICT Service Request System built during **Laboratory 3** and expanded in **Laboratory 4**. It allows students and staff (Requesters) to submit ICT service and hardware requests, while providing Administrators with tools to manage, approve, reject, and audit all incoming workflow activities.

### Tech Stack
* **Frontend:** HTML5, CSS3, JavaScript (ES6+ Modules)
* **Backend / Database:** Supabase (PostgreSQL, Authentication, Row-Level Security)
* **Hosting:** GitHub Pages

---

## Test Credentials
* **Administrator Account:** `admin@gmail.com` | Password: `admin123`
* **Requester Account:** `student@gmail.com` | Password: `student123`

---

## Updated ERD and Use Case Diagram

### Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    auth_users ||--o| profiles : "has profile"
    profiles ||--o{ service_requests : "submits"
    profiles ||--o{ audit_logs : "performs action"
    service_requests ||--o{ audit_logs : "tracks changes"

    auth_users {
        uuid id PK
        string email
        string encrypted_password
        timestamp created_at
    }

    profiles {
        uuid id PK, FK
        string email
        string full_name
        string role "Administrator | Requester"
        timestamp created_at
    }

    service_requests {
        uuid id PK
        uuid user_id FK
        string requester_name
        string department
        string category
        text description
        string priority "Low | Medium | High"
        string status "Pending | In Progress | Approved | Rejected"
        timestamp created_at
    }

    audit_logs {
        uuid id PK
        uuid request_id FK
        uuid performed_by FK
        string action
        string previous_status
        string new_status
        timestamp timestamp
    }
```

### Use Case Diagram

```mermaid
graph LR
    subgraph System ["ICT Service Request System"]
        UC1(("Sign In / Authenticate"))
        UC2(("Submit Service Request"))
        UC3(("View Personal Request History"))
        UC4(("View All System Requests"))
        UC5(("Filter & Search Requests"))
        UC6(("Update Request Status"))
        UC7(("View Audit Logs"))
    end

    Requester["👤 Requester (Student/Staff)"]
    Admin["🛠️ Administrator"]

    Requester --> UC1
    Requester --> UC2
    Requester --> UC3
    Requester --> UC5

    Admin --> UC1
    Admin --> UC4
    Admin --> UC5
    Admin --> UC6
    Admin --> UC7
```

## Role-Permission Matrix

| Functional Module / Feature | Requester | Administrator |
| :--- | :---: | :---: |
| Authenticate / Sign In | Yes | Yes |
| View Own Request History | Yes | Yes |
| Submit New Service Request | Yes | No |
| View All System Requests | No | Yes |
| Filter & Search Requests | Self-Only | All Users |
| Update Request Status (Approve/Reject) | No | Yes |
| View Audit Logs | No | Yes |

---

## Workflow Diagram
```mermaid
sequenceDiagram
    autonumber
    actor Requester as 👤 Requester (Student)
    participant System as 💻 Web Interface
    participant Auth as 🔐 Supabase Auth
    participant DB as 🗄️ Database (PostgreSQL)
    actor Admin as 🛠️ Administrator

    %% Authentication Phase
    Requester->>System: Enter credentials & Submit Login
    System->>Auth: Authenticate User
    Auth-->>System: Return Auth Session Token
    System->>DB: Fetch Role from public.profiles
    DB-->>System: Return Role ('Requester')
    System-->>Requester: Load Requester Portal (Form Visible)

    %% Request Submission Phase
    Requester->>System: Fill & Submit Service Request Form
    System->>DB: INSERT into public.service_requests (Status: 'Pending')
    DB-->>System: Return Created Record
    System-->>Requester: Display Success & Update Table

    %% Admin Review Phase
    Admin->>System: Log in & Access Admin Dashboard
    System->>DB: SELECT * FROM public.service_requests
    DB-->>System: Return All System Requests
    System-->>Admin: Display Management Table with Action Controls

    %% Approval & Audit Phase
    Admin->>System: Click 'Approve' or 'Reject' on Request
    System->>DB: UPDATE service_requests SET status = 'Approved'
    System->>DB: INSERT into public.audit_logs (action, status_change, timestamp)
    DB-->>System: Confirm Update & Log Creation
    System-->>Admin: Refresh Table & Show Status Updated
```
## Business Rules

1. **Authentication Rule:** Users must be authenticated via Supabase Auth to access any dashboard functionality. Unauthenticated users are redirected to `login.html`.
2. **Default Role Assignment:** New users are automatically registered as `Requester` by default unless explicitly granted `Administrator` rights in `public.profiles`.
3. **Role-Based Visibility:**
   * **Requesters** can only see submission forms and their personal request history.
   * **Administrators** cannot submit requests, but can view, filter, and manage all requests.
4. **Status Lifecycle:** A request begins with a `Pending` status. Only Administrators can transition statuses (`Pending` $\rightarrow$ `In Progress` $\rightarrow$ `Approved` / `Rejected`).
5. **Audit Logging Rule:** Any status update performed by an Administrator automatically generates an immutable record in `public.audit_logs`.

---

## Audit-Log Screenshot

> Below is the recorded audit log output capturing status transitions and timestamps:

[AUDIT LOG ENTRY]
Timestamp: 2026-09-15 12:05:11 UTC
Performed By: admin@gmail.com (ID: 11111111-1111-1111-1111-111111111111)
Action: STATUS_UPDATE
Request ID: req_982347
Status Change: Pending -> Approved

<img width="829" height="232" alt="Screenshot 2026-09-16 132408" src="https://github.com/user-attachments/assets/47d47e9e-aa8d-422f-a9fa-eaf12db55870" />

---

## Functional Test Results

| Test Case | Description | User Role | Expected Result | Result |
| :--- | :--- | :---: | :--- | :---: |
| **TC-01** | User Login | Student | Access granted to Requester Portal | **PASS** |
| **TC-02** | Submit Request | Student | Request added with status `Pending` | **PASS** |
| **TC-03** | Admin Login | Admin | Access granted to Management Dashboard | **PASS** |
| **TC-04** | Role Interface Guard | Admin | Request submission form is hidden | **PASS** |
| **TC-05** | Update Status | Admin | Status changes from `Pending` to `Approved` | **PASS** |
| **TC-06** | Audit Trail Creation | System | Automated row added to `audit_logs` | **PASS** |
| **TC-07** | Logout | All | Session cleared and redirected to `login.html` | **PASS** |

                 
