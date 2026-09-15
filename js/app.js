let currentUser = null;
let allRequests = [];

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await checkAuth();
  if (currentUser) {
    loadRequests();
    
    if (currentUser.role === 'Requester') {
      setupFormListener();
    }
    
    if (currentUser.role === 'Administrator') {
      loadProfiles();
      loadAuditLogs();
    }
  }
});

async function logAudit(action, module, recordId, description) {
  await supabaseClient.from('audit_logs').insert([{
    user_id: currentUser.id,
    user_name: currentUser.full_name || currentUser.email,
    action,
    module,
    record_id: recordId,
    description
  }]);
}

function setupFormListener() {
  const form = document.getElementById('request-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const requester_name = document.getElementById('req-name').value.trim();
    const department = document.getElementById('req-dept').value.trim();
    const category = document.getElementById('req-category').value;
    const description = document.getElementById('req-desc').value.trim();
    const priority = document.getElementById('req-priority').value;

    // Business Rules BR-01 to BR-05 Validation
    if (!requester_name || !department || !category || !description) {
      alert("All fields are required!");
      return;
    }

    const { data, error } = await supabaseClient.from('service_requests').insert([{
      requester_name,
      department,
      category,
      description,
      priority,
      status: 'Pending', // BR-06 Default Pending
      user_id: currentUser.id
    }]).select();

    if (error) {
      alert("Error submitting request: " + error.message);
    } else {
      await logAudit('SUBMITTED', 'Service Request', data[0].id, `Created request: ${category}`);
      alert("Request submitted successfully!");
      form.reset();
      loadRequests();
    }
  });
}

async function loadRequests() {
  const { data, error } = await supabaseClient.from('service_requests').select('*').order('created_at', { ascending: false });
  if (error) return;

  allRequests = data || [];
  updateDashboardStats(allRequests);
  filterRequests();
}

function updateDashboardStats(requests) {
  document.getElementById('stat-total').textContent = requests.length;
  document.getElementById('stat-pending').textContent = requests.filter(r => r.status === 'Pending').length;
  document.getElementById('stat-progress').textContent = requests.filter(r => r.status === 'In Progress').length;
  document.getElementById('stat-completed').textContent = requests.filter(r => r.status === 'Completed').length;
}

function filterRequests() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const statusFilter = document.getElementById('filter-status').value;
  const priorityFilter = document.getElementById('filter-priority').value;

  const filtered = allRequests.filter(req => {
    const matchesSearch = req.requester_name.toLowerCase().includes(search) || req.description.toLowerCase().includes(search);
    const matchesStatus = statusFilter === 'All' || req.status === statusFilter;
    const matchesPriority = priorityFilter === 'All' || req.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  renderTable(filtered);
}

function renderTable(requests) {
  const tbody = document.getElementById('requests-tbody');
  tbody.innerHTML = '';

  requests.forEach(req => {
    const row = document.createElement('tr');
    
    let actionsHtml = '';
    if (currentUser.role === 'Administrator') {
      // Admin Approval Workflow Controls (BR-A4-03)
      if (req.status === 'Pending') {
        actionsHtml = `
          <button onclick="updateStatus(${req.id}, 'Approved')">Approve</button>
          <button onclick="updateStatus(${req.id}, 'Rejected')">Reject</button>
        `;
      } else if (req.status === 'Approved') {
        actionsHtml = `<button onclick="updateStatus(${req.id}, 'In Progress')">Start Progress</button>`;
      } else if (req.status === 'In Progress') {
        actionsHtml = `<button onclick="updateStatus(${req.id}, 'Completed')">Complete</button>`;
      } else {
        actionsHtml = `<span>Closed (${req.status})</span>`;
      }
      actionsHtml += ` <button onclick="deleteRequest(${req.id})">Delete</button>`;
    } else {
      // Student / Requester controls
      if (req.user_id === currentUser.id && req.status === 'Pending') {
        actionsHtml = `<button onclick="deleteRequest(${req.id})">Cancel Request</button>`;
      } else {
        actionsHtml = `<span>View Only</span>`;
      }
    }

    row.innerHTML = `
      <td>${req.id}</td>
      <td>${req.requester_name}</td>
      <td>${req.department}</td>
      <td>${req.category}</td>
      <td>${req.description}</td>
      <td><b>${req.priority}</b></td>
      <td><b>${req.status}</b></td>
      <td>${actionsHtml}</td>
    `;
    tbody.appendChild(row);
  });
}

async function updateStatus(id, newStatus) {
  if (currentUser.role !== 'Administrator') {
    alert("BR-A4-03: Only Administrators can approve/reject requests!");
    return;
  }

  await supabaseClient.from('service_requests').update({ status: newStatus }).eq('id', id);
  await logAudit(newStatus.toUpperCase(), 'Service Request', id, `Updated request #${id} status to ${newStatus}`);
  
  loadRequests();
  if (currentUser.role === 'Administrator') loadAuditLogs();
}

async function deleteRequest(id) {
  // BR-08 Delete confirmation requirement
  if (!confirm("BR-08: Are you sure you want to delete this request?")) return;

  await supabaseClient.from('service_requests').delete().eq('id', id);
  await logAudit('DELETED', 'Service Request', id, `Deleted request #${id}`);

  loadRequests();
  if (currentUser.role === 'Administrator') loadAuditLogs();
}

async function loadProfiles() {
  const { data: profiles } = await supabaseClient.from('profiles').select('*');
  const tbody = document.getElementById('profiles-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  (profiles || []).forEach(prof => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${prof.id}</td>
      <td>${prof.email}</td>
      <td>${prof.full_name || 'N/A'}</td>
      <td><b>${prof.role}</b></td>
    `;
    tbody.appendChild(row);
  });
}

async function loadAuditLogs() {
  const { data: logs } = await supabaseClient.from('audit_logs').select('*').order('created_at', { ascending: false });
  const tbody = document.getElementById('audit-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  (logs || []).forEach(log => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${new Date(log.created_at).toLocaleString()}</td>
      <td>${log.user_name}</td>
      <td><b>${log.action}</b></td>
      <td>${log.module}</td>
      <td>${log.record_id || 'N/A'}</td>
      <td>${log.description}</td>
    `;
    tbody.appendChild(row);
  });
}
