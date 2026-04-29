let authClientPromise;

function getAuthClient() {
  if (!authClientPromise) {
    authClientPromise = Promise.all([
      fetch('/api/config', { cache: 'no-store' }).then((res) => res.json()),
      import('https://esm.sh/@supabase/supabase-js@2'),
    ]).then(([config, mod]) => {
      if (!config.connected) throw new Error('Supabase no está configurado en Vercel.');
      return mod.createClient(config.supabaseUrl, config.supabaseAnonKey);
    });
  }
  return authClientPromise;
}

function translateAuthError(message = '') {
  const lower = message.toLowerCase();
  if (lower.includes('email not confirmed')) return 'Tu email todavía no está confirmado. Revisa el correo de Supabase o usa “Enviar enlace de acceso”.';
  if (lower.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (lower.includes('signup is disabled')) return 'El registro está desactivado en Supabase Auth.';
  if (lower.includes('password')) return 'La contraseña debe tener al menos 6 caracteres.';
  return message || 'No se pudo completar el acceso.';
}

function setAuthMessage(message, tone = 'neutral') {
  const messageNode = document.querySelector('.auth-message');
  if (!messageNode) return;
  messageNode.textContent = message;
  messageNode.dataset.tone = tone;
}

function setBusy(isBusy) {
  document.querySelectorAll('.auth-login,.auth-signup,.auth-magic').forEach((button) => {
    button.disabled = isBusy;
    button.classList.toggle('is-loading', isBusy);
  });
}

function ensureMagicButton() {
  const actions = document.querySelector('.auth-actions');
  if (!actions || actions.querySelector('.auth-magic')) return;
  const button = document.createElement('button');
  button.className = 'secondary-button auth-magic';
  button.type = 'button';
  button.textContent = 'Enviar enlace de acceso';
  actions.appendChild(button);
}

function readCredentials(needsPassword = true) {
  const email = document.querySelector('.auth-email')?.value.trim();
  const password = document.querySelector('.auth-password')?.value;
  if (!email) throw new Error('Introduce tu email.');
  if (needsPassword && !password) throw new Error('Introduce tu contraseña.');
  return { email, password };
}

async function handleAuthClick(event) {
  const button = event.target.closest('.auth-login,.auth-signup,.auth-magic');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  try {
    setBusy(true);
    const client = await getAuthClient();
    const isMagic = button.classList.contains('auth-magic');
    const isSignup = button.classList.contains('auth-signup');
    const { email, password } = readCredentials(!isMagic);

    if (isMagic) {
      const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
      setAuthMessage('Te hemos enviado un enlace de acceso. Ábrelo desde este dispositivo.', 'success');
      return;
    }

    if (isSignup) {
      const { error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
      setAuthMessage('Cuenta creada. Revisa el email de confirmación o usa “Enviar enlace de acceso”.', 'success');
      return;
    }

    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setAuthMessage('Entrando…', 'success');
    window.location.reload();
  } catch (error) {
    setAuthMessage(translateAuthError(error.message), 'error');
  } finally {
    setBusy(false);
  }
}

document.addEventListener('click', handleAuthClick, true);
new MutationObserver(ensureMagicButton).observe(document.documentElement, { childList: true, subtree: true });
ensureMagicButton();
