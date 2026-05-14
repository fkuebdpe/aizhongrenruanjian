document.addEventListener('DOMContentLoaded', function() {
    loadMessages();
    
    document.getElementById('messageForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const message = document.getElementById('message').value;
        
        fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, message })
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                loadMessages();
                document.getElementById('messageForm').reset();
            }
        });
    });
});

function loadMessages() {
    fetch('/api/messages')
        .then(response => response.json())
        .then(data => {
            const messagesDiv = document.getElementById('messages');
            if (!messagesDiv) return;
            
            messagesDiv.innerHTML = data.map(msg => `
                <div class="message-item">
                    <h3>${msg.username}</h3>
                    <p>${msg.message}</p>
                    <small>留言时间：${new Date(msg.timestamp).toLocaleString()}</small>
                </div>
            `).join('');
        })
        .catch(error => {
            console.error('加载留言失败:', error);
            messagesDiv.innerHTML = '<p>加载留言失败，请稍后重试</p>';
        });
}

document.addEventListener('DOMContentLoaded', function() {
    loadAds();
    
    document.getElementById('adForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData();
        formData.append('title', document.getElementById('adTitle').value);
        formData.append('content', document.getElementById('adContent').value);
        formData.append('taobaoLink', document.getElementById('taobaoLink').value);
        formData.append('productImage', document.getElementById('productImage').files[0]);
        formData.append('qrCode', document.getElementById('qrCode').files[0]);
        
        fetch('/api/ads', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                loadAds();
                document.getElementById('adForm').reset();
            }
        });
    });
});

function loadAds() {
    fetch('/api/ads')
        .then(response => response.json())
        .then(data => {
            const adsDiv = document.getElementById('ads');
            if (!adsDiv) return;
            
            adsDiv.innerHTML = data.map(ad => `
                <div class="ad-item">
                    <h3>${ad.title}</h3>
                    <p>${ad.content}</p>
                    ${ad.taobaoLink ? `<a href="${ad.taobaoLink}" target="_blank">淘宝客链接</a>` : ''}
                    ${ad.productImageUrl ? `<img src="${ad.productImageUrl}" class="ad-image">` : ''}
                    ${ad.qrCodeUrl ? `<img src="${ad.qrCodeUrl}" class="qr-code">` : ''}
                    <small>发布时间：${new Date(ad.timestamp).toLocaleString()}</small>
                </div>
            `).join('');
        });
}