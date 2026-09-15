document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      
      if (error) {
        alert("Login Failed: " + error.message);
      } else {
        window.location.href = 'index.html';
      }
    });
  }
});

async function checkAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  
  if (!session && !window.location.pathname.endsWith('login.html')) {
    window.location.href = 'login.html';
    return null;
  }

  if (session) {
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    const currentUser = { ...session.user, role: profile?.role || 'Requester', full_name: profile?.full_name || session.user.email };
    applyRoleInterface(currentUser.role);
    return currentUser;
  }
}

function applyRoleInterface(role) {
  const roleDisplay = document.getElementById('user-role-display');
  if (roleDisplay) roleDisplay.textContent = `Active Role: ${role}`;

  if (role !== 'Administrator') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }

  if (role === 'Requester') {
    document.querySelectorAll('.staff-only').forEach(el => el.style.display = 'none');
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}