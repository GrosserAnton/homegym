import { signInWithUsername, signUp, usernameAvailable } from "../store.js";
import { esc, toast } from "../ui.js";

let mode = "login";

export async function render(el, ctx) {
  el.innerHTML = view();
  wire(el, ctx);
}

function view() {
  const isLogin = mode === "login";
  return `<div class="auth-wrap">
    <div class="brand">
      <div class="logo">Home<b>Gym</b></div>
      <div class="tag">Your home-gym training buddy</div>
    </div>
    <form id="auth-form" novalidate>
      <label class="field"><span class="lab">Username</span>
        <input id="username" autocomplete="username" required /></label>
      ${!isLogin ? `<label class="field"><span class="lab">Email</span>
        <input id="email" type="email" autocomplete="email" required /></label>` : ""}
      <label class="field"><span class="lab">Password</span>
        <input id="password" type="password" autocomplete="${isLogin ? "current-password" : "new-password"}" minlength="6" required /></label>
      <button class="btn primary" id="submit" type="submit">${isLogin ? "Log in" : "Create account"}</button>
    </form>
    <div class="switch-line">${isLogin ? "New here?" : "Already have an account?"}
      <a id="toggle">${isLogin ? "Create an account" : "Log in"}</a></div>
  </div>`;
}

function wire(el, ctx) {
  el.querySelector("#toggle").addEventListener("click", () => {
    mode = mode === "login" ? "register" : "login";
    render(el, ctx);
  });
  el.querySelector("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = el.querySelector("#submit");
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Please wait…";
    try {
      const username = el.querySelector("#username").value.trim();
      const password = el.querySelector("#password").value;
      if (!username) throw new Error("Please enter your username.");
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");
      if (mode === "login") {
        await signInWithUsername(username, password);
      } else {
        const email = el.querySelector("#email").value.trim();
        if (!email) throw new Error("Please enter your email.");
        const free = await usernameAvailable(username);
        if (!free) throw new Error("That username is already taken — pick another.");
        const data = await signUp(email, password, username);
        if (!data.session) {
          toast("Account created — confirm via the email we sent, then log in.", "ok");
          mode = "login";
          render(el, ctx);
          return;
        }
      }
      // Success with a session -> app.js onAuthStateChange re-renders.
    } catch (err) {
      toast(err.message || "Something went wrong", "error");
      btn.disabled = false;
      btn.textContent = label;
    }
  });
}
