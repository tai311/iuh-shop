const SUPABASE_URL = "https://xecxofmogvqysejjpxvl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_3cUVsNUvhbzUReIB3oA41w_0aqdUJqC";
const supabaseClient = window.IUHCore.getClient();
const registerForm = document.getElementById("registerForm");
const studentCardInput = document.getElementById("studentCard");
const studentCardPreview = document.getElementById("studentCardPreview");
let previewURL = null;
let registrationInFlight = false;
function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    input.type = input.type === "password" ? "text" : "password";
    button.textContent = input.type === "password" ? "Hiện" : "Ẩn";
}
function validStudentCard(file) {
    return file && ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 5 * 1024 * 1024;
}
studentCardInput?.addEventListener("change", () => {
    if (previewURL) URL.revokeObjectURL(previewURL);
    studentCardPreview?.replaceChildren();
    studentCardPreview?.classList.remove("show");
    const file = studentCardInput.files?.[0];
    if (!file) return;
    if (!validStudentCard(file)) {
        studentCardInput.value = "";
        alert("Vui lòng chọn ảnh JPG, PNG hoặc WebP tối đa 5MB.");
        return;
    }
    previewURL = URL.createObjectURL(file);
    const image = document.createElement("img");
    image.src = previewURL;
    image.alt = "Thẻ sinh viên";
    studentCardPreview?.appendChild(image);
    studentCardPreview?.classList.add("show");
});
registerForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (registrationInFlight) return;
    const value = id => document.getElementById(id).value.trim();
    const fullName = value("fullName"), studentId = value("studentId"), faculty = value("faculty");
    const email = value("email"), phone = value("phone");
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const isGraduated = document.getElementById("isGraduated").checked;
    const file = studentCardInput.files?.[0];
    const message = document.getElementById("formMessage");
    const button = registerForm.querySelector(".auth-button");
    message.style.color = "#d64545";
    if (!fullName || !studentId || !faculty || !email || !phone) { message.textContent = "Vui lòng điền đầy đủ thông tin."; return; }
    if (password.length < 8 || password !== confirmPassword) { message.textContent = "Mật khẩu cần ít nhất 8 ký tự và hai lần nhập phải khớp."; return; }
    if (!document.getElementById("agreeTerms").checked) { message.textContent = "Vui lòng đồng ý với điều khoản sử dụng."; return; }
    if (!validStudentCard(file)) { message.textContent = "Vui lòng chọn ảnh thẻ JPG, PNG hoặc WebP tối đa 5MB."; return; }
    registrationInFlight = true;
    button.disabled = true;
    button.textContent = "ĐANG TẠO TÀI KHOẢN...";
    let accountCreated = false;
    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email, password, options: {
                emailRedirectTo: new URL("dangnhap.html?verify=1", window.location.href).href,
                data: { fullname: fullName, student_id: studentId, faculty, phone, is_graduated: isGraduated }
            }
        });
        if (error) throw error;
        if (!data?.user) throw new Error("Không thể hoàn tất đăng ký. Vui lòng thử lại.");
        accountCreated = true;
        if (!data.session) {
            message.style.color = "#193f9e";
            message.textContent = "Vui lòng kiểm tra email để xác nhận tài khoản, sau đó đăng nhập và tải thẻ tại mục Xác thực tài khoản. Nếu email đã đăng ký, hãy đăng nhập hoặc khôi phục mật khẩu.";
            button.textContent = "KIỂM TRA EMAIL ĐỂ TIẾP TỤC";
            return;
        }
        const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
        const objectPath = `${data.user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabaseClient.storage.from("student-cards").upload(objectPath, file, { upsert: false, contentType: file.type });
        if (uploadError) throw uploadError;
        const { data: profile, error: profileError } = await supabaseClient.from("users").update({
            student_card_url: objectPath, is_graduated: isGraduated,
            verification_status: "pending", terms_accepted: true,
            terms_accepted_at: new Date().toISOString(), terms_version: "2026-09"
        }).eq("user_id", data.user.id).select("user_id").single();
        if (profileError || !profile) throw profileError || new Error("Chưa lưu được thông tin thẻ.");
        message.style.color = "#193f9e";
        message.textContent = "Đăng ký thành công. Thẻ sinh viên đang chờ xác thực.";
        window.location.href = "taikhoan.html";
    } catch (error) {
        console.error("Đăng ký:", error);
        if (accountCreated) {
            message.textContent = "Tài khoản đã tạo nhưng chưa hoàn tất gửi thẻ. Hãy đăng nhập bằng email và tải lại thẻ tại mục Xác thực tài khoản.";
            const link = document.createElement("a");
            link.href = "dangnhap.html?verify=1";
            link.textContent = " Đăng nhập để tiếp tục";
            message.appendChild(link);
            button.textContent = "TÀI KHOẢN ĐÃ ĐƯỢC TẠO";
        } else {
            message.textContent = error.message || "Đăng ký chưa thành công. Vui lòng thử lại.";
        }
    } finally {
        registrationInFlight = false;
        if (!accountCreated) { button.disabled = false; button.textContent = "ĐĂNG KÝ"; }
    }
});
