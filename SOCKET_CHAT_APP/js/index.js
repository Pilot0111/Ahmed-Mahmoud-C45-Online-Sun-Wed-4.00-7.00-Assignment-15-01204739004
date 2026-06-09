const baseURL = 'http://localhost:3000'

$("#login").click(() => {
    const email = $("#email").val();
    const password = $("#password").val();
    const data = {
        email,
        password
    }
    console.log({ data });
    axios({
        method: 'post',
        url: `${baseURL}/auth/signin`,
        data: data,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' }
    }).then(function (response) {
       // Log the entire response body to see the structure
        console.log("Extracted Data:", {
            token: response.data.data?.token,
            prefix: response.data.data?.prefix,
            message: response.data.message
        }); 
     
        const { data, message } = response.data
        // Aligning with Backend: Check for data.token and store the prefix
        if (data && data.token) {
            localStorage.setItem('accessToken', data.token);
            localStorage.setItem('authPrefix', data.prefix); 
            // Set wait for 10 seconds to see the response in the console before redirecting
            setTimeout(() => {
                console.log("Redirecting to chat.html...");
                window.location.href = 'chat.html';
            }, 1000);
        } else {
            alert(message || "Invalid email or password");
        }
    }).catch(function (error) {
        const errorMsg = error.response?.data?.message || "An error occurred during login";
        console.error("Login Error:", errorMsg);
        alert(errorMsg);
    });
})
