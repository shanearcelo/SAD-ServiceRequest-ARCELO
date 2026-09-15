document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      
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

    const currentUser = { 
      ...session.user, 
      role: profile?.role || 'Requester', 
      full_name: profile?.full_name || session.user.email 
    };
    
    applyRoleInterface(currentUser);
    return currentUser;
  }
}

function applyRoleInterface(user) {
  const userDisplay = document.getElementById('user-display');
  if (userDisplay) userDisplay.textContent = `User: ${user.full_name} (${user.role})`;

  if (user.role === 'Administrator') {
    document.querySelectorAll('.requester-only').forEach(el => el.style.display = 'none');
  } else {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}
