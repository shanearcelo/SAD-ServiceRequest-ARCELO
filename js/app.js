let user = null;

document.addEventListener('DOMContentLoaded', async () => {
  user = await checkAuth();
  if (user) {
    loadEquipment();
    loadMyRequests();
    if (user.role === 'Administrator' || user.role === 'Laboratory Staff') {
      loadOperations();
    }
    if (user.role === 'Administrator') {
      loadApprovals();
      loadAuditLogs();
    }
  }
});

async function logAudit(action, module, recordId, description) {
  await supabaseClient.from('audit_logs').insert([{
    user_id: user.id,
    user_name: user.full_name || user.email,
    action,
    module,
    record_id: recordId,
    description
  }]);
}

async function loadEquipment() {
  const { data: items } = await supabaseClient.from('equipment').select('*');
  const tbody = document.getElementById('equipment-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  (items || []).forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.id}</td>
      <td>${item.asset_code}</td>
      <td>${item.name}</td>
      <td>${item.category}</td>
      <td><b>${item.status}</b></td>
      <td>
        ${item.status === 'Available' 
          ? `<button class="btn btn-primary" onclick="requestBorrow(${item.id})">Request Borrow</button>` 
          : '<span style="color: red;">Unavailable</span>'}
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function requestBorrow(equipmentId) {
  const { data: item } = await supabaseClient.from('equipment').select('status').eq('id', equipmentId).single();

  if (item.status === 'Maintenance') {
    alert("BR-A4-09: Equipment under Maintenance cannot be borrowed.");
    return;
  }
  if (item.status !== 'Available') {
    alert("BR-A4-01: Only Available equipment may be requested.");
    return;
  }

  const { data, error } = await supabaseClient.from('borrow_requests').insert([{
    user_id: user.id,
    equipment_id: equipmentId,
    status: 'Pending'
  }]).select();

  if (!error) {
    await logAudit('SUBMITTED', 'Borrowing', data[0].id, `Submitted request for Equipment ID ${equipmentId}`);
    alert("Request saved as Pending (BR-A4-02).");
    loadMyRequests();
  }
}

async function loadMyRequests() {
  const { data: requests } = await supabaseClient
    .from('borrow_requests')
    .select('*')
    .eq('user_id', user.id);

  const tbody = document.getElementById('my-requests-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  (requests || []).forEach(req => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${req.id}</td>
      <td>${req.equipment_id}</td>
      <td><b>${req.status}</b></td>
      <td>${new Date(req.created_at).toLocaleString()}</td>
    `;
    tbody.appendChild(row);
  });
}

async function loadApprovals() {
  const { data: requests } = await supabaseClient
    .from('borrow_requests')
    .select('*')
    .eq('status', 'Pending');

  const tbody = document.getElementById('approvals-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  (requests || []).forEach(req => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${req.id}</td>
      <td>${req.user_id}</td>
      <td>${req.equipment_id}</td>
      <td>
        <button class="btn btn-primary" onclick="processApproval(${req.id}, '${req.user_id}', true)">Approve</button>
        <button class="btn btn-danger" onclick="processApproval(${req.id}, '${req.user_id}', false)">Reject</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function processApproval(requestId, requesterId, isApproved) {
  if (user.role !== 'Administrator') {
    alert("BR-A4-03: Only Administrators may approve or reject requests.");
    return;
  }

  if (user.id === requesterId) {
    alert("BR-A4-02: Staff/Admins cannot approve their own requests.");
    return;
  }

  const newStatus = isApproved ? 'Approved' : 'Rejected';

  await supabaseClient.from('borrow_requests').update({ status: newStatus }).eq('id', requestId);

  await logAudit(
    isApproved ? 'APPROVED' : 'REJECTED',
    'Borrowing',
    requestId,
    `${newStatus} borrowing request #${requestId}`
  );

  alert(`Request updated to ${newStatus}.`);
  loadApprovals();
  if (user.role === 'Administrator' || user.role === 'Laboratory Staff') loadOperations();
  if (user.role === 'Administrator') loadAuditLogs();
}

async function loadOperations() {
  const { data: requests } = await supabaseClient
    .from('borrow_requests')
    .select('*')
    .in('status', ['Approved', 'Released', 'Rejected']);

  const tbody = document.getElementById('operations-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  (requests || []).forEach(req => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${req.id}</td>
      <td>${req.equipment_id}</td>
      <td><b>${req.status}</b></td>
      <td>
        ${req.status === 'Approved' ? `<button class="btn btn-primary" onclick="releaseEquipment(${req.id}, ${req.equipment_id})">Release</button>` : ''}
        ${req.status === 'Released' ? `
          <button class="btn btn-primary" onclick="returnEquipment(${req.id}, ${req.equipment_id}, false)">Return (Normal)</button>
          <button class="btn btn-danger" onclick="returnEquipment(${req.id}, ${req.equipment_id}, true)">Return (Damaged)</button>
        ` : ''}
        ${req.status === 'Rejected' ? `<button class="btn btn-secondary" onclick="attemptReleaseRejected()">Attempt Release</button>` : ''}
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function releaseEquipment(requestId, equipmentId) {
  const { data: req } = await supabaseClient.from('borrow_requests').select('status').eq('id', requestId).single();

  if (req.status !== 'Approved') {
    alert("BR-A4-04 / BR-A4-07: Only Approved requests may be released.");
    return;
  }

  await supabaseClient.from('borrow_requests').update({ status: 'Released' }).eq('id', requestId);
  await supabaseClient.from('equipment').update({ status: 'Borrowed' }).eq('id', equipmentId);

  await logAudit('RELEASED', 'Borrowing', requestId, `Released equipment ID ${equipmentId} (BR-A4-05)`);
  alert("Equipment successfully released.");
  loadEquipment();
  loadOperations();
}

function attemptReleaseRejected() {
  alert("BR-A4-07: Rejected requests cannot be released. Operation blocked.");
}

async function returnEquipment(requestId, equipmentId, isDamaged) {
  const { data: req } = await supabaseClient.from('borrow_requests').select('status').eq('id', requestId).single();

  if (req.status === 'Returned' || req.status === 'Closed') {
    alert("BR-A4-08: Returned transactions cannot be processed twice.");
    return;
  }

  const newEquipStatus = isDamaged ? 'Maintenance' : 'Available';

  await supabaseClient.from('borrow_requests').update({ status: 'Returned' }).eq('id', requestId);
  await supabaseClient.from('equipment').update({ status: newEquipStatus }).eq('id', equipmentId);

  await logAudit('RETURNED', 'Borrowing', requestId, `Returned equipment ID ${equipmentId} (BR-A4-06)`);
  alert("Equipment returned successfully.");
  loadEquipment();
  loadOperations();
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
      <td>${log.description}</td>
    `;
    tbody.appendChild(row);
  });
}