const SUPABASE_URL = "https://xecxofmogvqysejjpxvl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_3cUVsNUvhbzUReIB3oA41w_0aqdUJqC";
const supabaseClient = window.IUHCore.getClient();
function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    input.type = input.type === "password" ? "text" : "password";
    button.textContent = input.type === "password" ? "Hiện" : "Ẩn";
}
const loginForm = document.getElementById("loginForm");
let loginInFlight = false;
loginForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (loginInFlight) return;
    const email = document.getElementById("loginAccount").value.trim();
    const password = document.getElementById("loginPassword").value;
    if (!email.includes("@") || !password) { alert("Vui lòng dùng email đã đăng ký và nhập mật khẩu."); return; }
    const button = loginForm.querySelector(".auth-button");
    loginInFlight = true;
    button.disabled = true;
    button.textContent = "ĐANG ĐĂNG NHẬP...";
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = new URLSearchParams(location.search).get("verify") === "1"
            ? "taikhoan.html?verify=1" : "trangchu.html";
    } catch (error) {
        alert(error.code === "email_not_confirmed"
            ? "Vui lòng xác nhận email trước khi đăng nhập."
            : "Chưa thể đăng nhập. Hãy kiểm tra email, mật khẩu và thử lại.");
    } finally {
        loginInFlight = false;
        button.disabled = false;
        button.textContent = "ĐĂNG NHẬP";
    }
});
