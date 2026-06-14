
const baseURL = 'http://localhost:3000'
const token = localStorage.getItem("accessToken");
const prefix = localStorage.getItem("authPrefix");
let globalProfile = {};
const headers = {
    'Content-Type': 'application/json; charset=UTF-8',
    'authorization': `${prefix} ${token}`
};
const clintIo = io(baseURL, {
    auth: {
        // Use the prefix stored during login (e.g., "Bearer" or "Admin")
        authorization: `${prefix} ${token}`
    }
})

clintIo.on("connect_error", (err) => {
    console.log("connect_error:", err.message);
});

clintIo.on("custom_error", (err) => {
    console.log("custom_error:", err.message);
});

clintIo.emit("sayHi", "FROM FE TO BE", (response) => {
    console.log({ response });
})
clintIo.on("offline_user", data => {
    console.log({ data });
})



// clintIo.on("likePost", data => {
//     console.log({ likeData: data })
// })


//images links
let avatar = './avatar/Avatar-No-Background.png'
let meImage = './avatar/Avatar-No-Background.png'
let friendImage = './avatar/Avatar-No-Background.png'


// // // // // // collect messageInfo
function sendMessage(sendTo, type) {
    console.log({ sendTo, type });
    const content = $("#messageBody").val();
    if (type == "ovo") {
        // Match backend event name: 'privateMessage'
        clintIo.emit('privateMessage', { 
            targetId: sendTo, 
            message: content 
        });
    } else if (type == "group") {
        clintIo.emit('sendGroupMessage', {
            content: content,
            groupId: sendTo,
        });
    }
}

// Helper to append token to image URLs for authentication via Query Params
const getAuthImg = (path) => `${baseURL}/auth/get-file/${path}?token=${token}&prefix=${prefix}`;

// // // // // //sendCompleted
clintIo.on('successMessage', (data) => {
    const { content } = data
    const div = document.createElement('div');

    div.className = 'me text-end p-2';
    div.dir = 'rtl';
    const imagePath = globalProfile.profilePicture ? getAuthImg(globalProfile.profilePicture) : avatar;
    div.innerHTML = `
    <img class="chatImage" src="${imagePath}" alt="" srcset="">
    <span class="mx-2">${content}</span>
    `;
    
    const messageList = document.getElementById('messageList');
    if (messageList.children.length >= 5) {
        messageList.removeChild(messageList.firstElementChild);
    }
    messageList.appendChild(div);
    $(".noResult").hide()
    $("#messageBody").val('')
})


// // // // // // // // // //receiveMessage
clintIo.on("directMessage", (data) => {
    console.log({ RM: data });
    const { message, from, groupId } = data
    console.log({ from });

    let imagePath = avatar;
    if (from?.profilePicture) {
        imagePath = getAuthImg(from.profilePicture);
    }
    const onclickAttr = document.getElementById("sendMessage").getAttribute("onclick")
    const [base, currentOpenedChat] = onclickAttr?.match(/sendMessage\('([^']+)'/) || [];
    console.log({ currentOpenedChat });
    console.log({ onclickAttr, currentOpenedChat });

    if ((!groupId && currentOpenedChat === from._id) || (groupId && currentOpenedChat === groupId)) {
        if (from._id.toString() != globalProfile._id.toString()) {
            const div = document.createElement('div');
            div.className = 'myFriend p-2';
            div.dir = 'ltr';
            div.innerHTML = `
    <img class="chatImage" src="${imagePath}" alt="" srcset="">
    <span class="mx-2">${message}</span>
    `;
            const messageList = document.getElementById('messageList');
            if (messageList.children.length >= 5) {
                messageList.removeChild(messageList.firstElementChild);
            }
            messageList.appendChild(div);
        }

    } else {

        if (groupId) {
            $(`#g_${groupId}`).show();
        } else {
            $(`#c_${from._id}`).show();

        }
        const audio = document.getElementById("notifyTone");
        audio.currentTime = 0; // restart from beginning
        audio.play().catch(err => console.log("Audio play blocked:", err));
    }
})


// // // // // // // ******************************************************************** Show chat conversation
function showData(sendTo, chat) {
    document.getElementById("sendMessage").setAttribute("onclick", `sendMessage('${sendTo}' , "ovo")`);

    document.getElementById('messageList').innerHTML = ''
    if (chat.messages?.length) {
        $(".noResult").hide()
        for (const message of chat.messages) {
            // creatorId handles both populated objects and raw IDs
            const creatorId = message.createdBy._id ? message.createdBy._id.toString() : message.createdBy.toString();

            if (creatorId == globalProfile._id.toString()) {
                const div = document.createElement('div');
                div.className = 'me text-end p-2';
                div.dir = 'rtl';
                div.innerHTML = `
                <img class="chatImage" src="${meImage}" alt="" srcset="">
                <span class="mx-2">${message.content}</span>
                `;
                document.getElementById('messageList').appendChild(div);
            } else {

                const div = document.createElement('div');
                div.className = 'myFriend p-2';
                div.dir = 'ltr';
                div.innerHTML = `
                <img class="chatImage" src="${friendImage}" alt="" srcset="">
                <span class="mx-2">${message.content}</span>
                `;
                document.getElementById('messageList').appendChild(div);
            }

        }
    } else {
        const div = document.createElement('div');

        div.className = 'noResult text-center  p-2';
        div.dir = 'ltr';
        div.innerHTML = `
        <span class="mx-2">Say Hi to start the conversation.</span>
        `;
        document.getElementById('messageList').appendChild(div);
    }

    $(`#c_${sendTo}`).hide();


}

// // // // // // // // //get chat conversation between 2 users and pass it to ShowData fun
function displayChatUser(userId) {
    console.log({ userId });
    axios({
        method: 'get',
        url: `${baseURL}/auth/${userId}/chat`,
        headers
    }).then(function (response) {
        console.log({ response });
        // The repository now returns { meta, data }, so we rename 'data' to 'chat'
        const { data: chat } = response.data.data

        console.log(chat);
        if (chat) {
            // Apply authenticated image paths
            if (chat.participants[0]._id.toString() == globalProfile._id.toString()) {
                meImage = chat.participants[0].profilePicture ? getAuthImg(chat.participants[0].profilePicture) : avatar
                friendImage = chat.participants[1].profilePicture ? getAuthImg(chat.participants[1].profilePicture) : avatar
            } else {
                meImage = chat.participants[1].profilePicture ? getAuthImg(chat.participants[1].profilePicture) : avatar
                friendImage = chat.participants[0].profilePicture ? getAuthImg(chat.participants[0].profilePicture) : avatar
            }

            showData(userId, chat)
        } else {
            showData(userId, 0)
        }

    }).catch(function (error) {
        const status = error.response?.status;
        console.error("Chat History Error:", error);
        if (status == 400 || status == 404) {
            showData(userId, 0)
        } else {
            alert("Ops something went wrong")
        }

    });
}

// // // // // // // ********************************************************************
// // // // // // // ******************************************************************** Show  group chat conversation
function showGroupData(sendTo, chat) {
    document.getElementById("sendMessage").setAttribute("onclick", `sendMessage('${sendTo}' , "group")`);

    document.getElementById('messageList').innerHTML = ''
    if (chat.messages?.length) {
        $(".noResult").hide()
        for (const message of chat.messages) {
            const creatorId = message.createdBy._id ? message.createdBy._id.toString() : message.createdBy.toString();

            if (creatorId == globalProfile._id.toString()) {
                const div = document.createElement('div');
                div.className = 'me text-end p-2';
                div.dir = 'rtl';
                const myPic = globalProfile.profilePicture ? getAuthImg(globalProfile.profilePicture) : avatar;
                div.innerHTML = `
                <img class="chatImage" src="${myPic}" alt="" srcset="">
                <span class="mx-2">${message.content}</span>
                `;
                document.getElementById('messageList').appendChild(div);
            } else {
                const div = document.createElement('div');
                div.className = 'myFriend p-2';
                div.dir = 'ltr';
                const senderPic = message.createdBy.profilePicture ? getAuthImg(message.createdBy.profilePicture) : avatar;
                div.innerHTML = `
                <img class="chatImage" src="${senderPic}" alt="" srcset="">
                <span class="mx-2"><b>${message.createdBy.userName || 'User'}:</b> ${message.content}</span>
                `;
                document.getElementById('messageList').appendChild(div);
            }
        }
    } else {
        const div = document.createElement('div');

        div.className = 'noResult text-center  p-2';
        div.dir = 'ltr';
        div.innerHTML = `
        <span class="mx-2">Say Hi to start the conversation.</span>
        `;
        document.getElementById('messageList').appendChild(div);
    }
    $(`#g_${sendTo}`).hide();
}
// // // // // // // // ********************************************************************
function displayGroupChat(groupId) {
    console.log({ groupId });
    axios({
        method: 'get',
        url: `${baseURL}/auth/chat/group/${groupId}`,
        headers
    }).then(function (response) {
        // The repository paginateMessages returns { meta, data: chatDoc }
        const chat = response.data?.data?.data;
        if (chat) {
            showGroupData(groupId, chat)
        } else {
            showGroupData(groupId, { messages: [] })
        }
    }).catch(function (error) {
        const status = error.response?.status;
        console.error("Group Chat Error:", error);
        if (status == 404) {
            showGroupData(groupId, { messages: [] })
        } else {
            alert("Ops something went wrong")
        }
    });
}
// // ==============================================================================================


// // // // // // ********************************************************* Show Users list 
// // // // // Display Users
function getUserData() {
    axios({
        method: 'get',
        url: `${baseURL}/auth/profile`,
        headers
    }).then(function (response) {
        console.log({ D: response.data });

        // Extracting user and groups as per instructor's backend logic
        const { user, groups } = response.data?.data || {};
        
        globalProfile = user;
        let imagePath = avatar;
        if (user.profilePicture) {
            imagePath = getAuthImg(user.profilePicture);
        }
        document.getElementById("profileImage").src = imagePath
        document.getElementById("userName").innerHTML = `${user.userName}`
        showUsersData(user.friends)
        showGroupList(groups)
    }).catch(function (error) {
        console.log(error);
    });
}
// // // // // Show friends list
function showUsersData(users = []) {
    let cartonna = ``
    for (let i = 0; i < users.length; i++) {
        let imagePath = avatar;
        if (users[i].profilePicture) {
            imagePath = getAuthImg(users[i].profilePicture);
        }
        cartonna += `
        <div onclick="displayChatUser('${users[i]._id}')" class="chatUser my-2">
        <img class="chatImage" src="${imagePath}" alt="" srcset="">
        <span class="ps-2">${users[i].userName}</span>
        <span id="${"c_" + users[i]._id}" class="ps-2 closeSpan">
           🟢
        </span>
    </div>

        `
    }


    document.getElementById('chatUsers').innerHTML = cartonna;
}

// // // // Show groups list
function showGroupList(groups = []) {
    let cartonna = ``
    for (let i = 0; i < groups.length; i++) {
        let imagePath = avatar;
        if (groups[i].groupImage) {
            imagePath = getAuthImg(groups[i].groupImage);
        }
        cartonna += `
        <div onclick="displayGroupChat('${groups[i]._id}')" class="chatUser my-2">
        <img class="chatImage" src="${imagePath}" alt="" srcset="">
        <span class="ps-2">${groups[i].group}</span>
           <span id="${"g_" + groups[i]._id}" class="ps-2 closeSpan">
           🟢
        </span>
    </div>

        `
        clintIo.emit("joinRoom", { roomId: groups[i].roomId })

    }


    document.getElementById('chatGroups').innerHTML = cartonna;
}


getUserData()
