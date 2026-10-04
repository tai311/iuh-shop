/* Student cards are private object paths, never public URLs. */
const supabaseClient = window.IUHCore?.getClient() || window.supabase.createClient(
    "https://xecxofmogvqysejjpxvl.supabase.co",
    "sb_publishable_3cUVsNUvhbzUReIB3oA41w_0aqdUJqC"
);
const registerForm = document.getElementById("registerForm");
const studentCardInput = document.getElementById("studentCard");
const studentCardPreview = document.getElementById("studentCardPreview");
const cardExtensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
let registering = false;
let accountCreated = false;

function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    input.type = input.type === "password" ? "text" : "password";
    button.textContent = input.type === "password" ? "Hiện" : "Ẩn";
}

function validCard(file) {
    return file && cardExtensions[file.type] && file.size > 0 && file.size <= 5 * 1024 * 1024;
}

studentCardInput.addEventListener("change", function () {
    studentCardPreview.replaceChildren();
    studentCardPreview.classList.remove("show");
    const file = this.files?.[0];
    if (!file) return;
    if (!validCard(file)) {
        this.value = "";
        alert("Chọn ảnh JPG, PNG hoặc WebP tối đa 5MB.");
        return;
    }
    const reader = new FileReader();
    reader.onload = event => {
        if (studentCardInput.files?.[0] !== file) return;
        const image = document.createElement("img");
        image.src = event.target.result;
        image.alt = "Thẻ sinh viên";
        studentCardPreview.replaceChildren(image);
        studentCardPreview.classList.add("show");
    };
    reader.readAsDataURL(file);
});

registerForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (registering || accountCreated) return;
    const value = id => document.getElementById(id).value.trim();
    const password = document.getElementById("password").value;
    const file = studentCardInput.files?.[0];
    const message = document.getElementById("formMessage");
    const button = registerForm.querySelector(".auth-button");
    const show = (text, failed = true) => {
        message.textContent = text;
        message.style.color = failed ? "#d64545" : "#193f9e";
    };
    show("");
    if (password.length < 8) return show("Mật khẩu phải có ít nhất 8 ký tự.");
    if (password !== document.getElementById("confirmPassword").value)
        return show("Mật khẩu xác nhận không trùng khớp.");
    if (!document.getElementById("agreeTerms").checked)
        return show("Vui lòng đồng ý với Điều khoản sử dụng.");
    if (!file) return show("Vui lòng tải lên thẻ sinh viên.");
    if (!validCard(file)) return show("Chọn ảnh JPG, PNG hoặc WebP tối đa 5MB.");

    registering = true;
    button.disabled = true;
    button.textContent = "ĐANG TẠO TÀI KHOẢN...";
    let hasSession = false;
    try {
        const isGraduated = document.getElementById("isGraduated").checked;
        const { data, error } = await supabaseClient.auth.signUp({
            email: value("email"), password,
            options: { data: {
                fullname: value("fullName"), student_id: value("studentId"),
                faculty: value("faculty"), phone: value("phone"), is_graduated: isGraduated
            } }
        });
        if (error) throw error;
        if (!data?.user) throw new Error("Không lấy được tài khoản vừa đăng ký. Vui lòng thử đăng nhập.");
        accountCreated = true;
        hasSession = Boolean(data.session);
        if (!hasSession) {
            show("Vui lòng kiểm tra email để xác nhận tài khoản, sau đó đăng nhập và gửi thẻ sinh viên tại mục Tài khoản → Xác thực sinh viên.", false);
            return;
        }
        const objectPath = `${data.user.id}/${crypto.randomUUID()}.${cardExtensions[file.type]}`;
        const { error: uploadError } = await supabaseClient.storage.from("student-cards")
            .upload(objectPath, file, { upsert: false, contentType: file.type });
        if (uploadError) throw uploadError;
        const { data: profile, error: profileError } = await supabaseClient.from("users").update({
            student_card_url: objectPath,
            verification_status: "pending",
            is_graduated: isGraduated
        }).eq("user_id", data.user.id).select("user_id").single();
        // A zero-row update must not be reported as a successful registration.
        if (profileError || !profile) throw profileError || new Error("Chưa lưu được thông tin thẻ.");
        show("Đăng ký thành công! Thẻ sinh viên đang chờ quản trị viên duyệt.", false);
        window.location.href = "taikhoan.html";
    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        if (accountCreated) {
            show("Tài khoản đã tạo nhưng chưa gửi được thẻ. Không cần đăng ký lại. " +
                (hasSession ? "Vào mục Tài khoản → Xác thực sinh viên để gửi lại thẻ."
                    : "Vui lòng đăng nhập rồi vào mục Tài khoản → Xác thực sinh viên để gửi lại thẻ."));
            const link = document.createElement("a");
            link.href = hasSession ? "taikhoan.html?verify=1" : "dangnhap.html";
            link.textContent = hasSession ? " Tiếp tục xác thực sinh viên" : " Đăng nhập";
            message.appendChild(link);
        } else {
            show(error.message || "Không thể kết nối. Vui lòng thử lại.");
        }
    } finally {
        registering = false;
        button.disabled = accountCreated;
        button.textContent = accountCreated ? "ĐÃ TẠO TÀI KHOẢN" : "ĐĂNG KÝ";
    }
});
