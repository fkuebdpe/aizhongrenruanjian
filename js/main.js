document.addEventListener('DOMContentLoaded', function() {
  // 初始化分页参数
  let currentPage = 1;
  const itemsPerPage = 6;
  let totalItems = 0;

  // 软件列表加载
  function loadSoftwareList(page = 1, searchQuery = '') {
    currentPage = page;
    const url = `/api/software?page=${page}&limit=${itemsPerPage}&search=${encodeURIComponent(searchQuery)}`;

    fetch(url)
      .then(response => response.json())
      .then(data => {
        totalItems = data.total || 0;
        const softwareList = document.getElementById('softwareList');
        if (!softwareList) return;

        softwareList.innerHTML = data.items.map(software => `
          <div class="software-item">
            <h3>${software.name}</h3>
            <p>${software.description}</p>
            <p>上传时间：${new Date(software.uploadTime).toLocaleString()}</p>
            <button onclick="downloadSoftware('${software.id}')">下载</button>
          </div>
        `).join('');

        updatePagination();
      });
}

  // 更新分页显示
  function updatePagination() {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginationDiv = document.getElementById('pagination');
    if (!paginationDiv) return;

    paginationDiv.innerHTML = `
      <button onclick="changePage(-1)" ${currentPage === 1 ? 'disabled' : ''}>上一页</button>
      <span>第 ${currentPage} 页 / 共 ${totalPages} 页</span>
      <button onclick="changePage(1)" ${currentPage === totalPages ? 'disabled' : ''}>下一页</button>
    `;
  }

  // 分页功能
  window.changePage = function(direction) {
    const newPage = currentPage + direction;
    if (newPage < 1 || newPage > Math.ceil(totalItems / itemsPerPage)) return;
    loadSoftwareList(newPage, document.getElementById('searchInput').value);
  };

  // 搜索功能
  window.searchSoftware = function() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    loadSoftwareList(1, query);
  };

  // 初始化加载
  loadSoftwareList();
});

// 下载功能
function downloadSoftware(softwareId) {
  const password = prompt('请输入下载密码：');
  if (password) {
    fetch(`/api/download/${softwareId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    .then(response => {
      if (response.redirected) {
        // 直接重定向到OSS下载链接
        window.location.href = response.url;
      } else {
        response.json().then(data => {
          alert(data.error || '下载失败，请检查密码');
        });
      }
    })
    .catch(error => {
      console.error('下载错误:', error);
      alert('下载请求失败');
    });
  }
}

// 登录状态管理
function checkLoginStatus() {
  const token = localStorage.getItem('jwtToken');
  if (token) {
    document.querySelectorAll('.auth-required').forEach(el => {
      el.style.display = 'block';
    });
    document.querySelectorAll('.guest-visible').forEach(el => {
      el.style.display = 'none';
    });
  } else {
    document.querySelectorAll('.auth-required').forEach(el => {
      el.style.display = 'none';
    });
    document.querySelectorAll('.guest-visible').forEach(el => {
      el.style.display = 'block';
    });
  }
}

// 登录功能
window.loginUser = async function(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    if (data.success) {
      localStorage.setItem('jwtToken', data.token);
      checkLoginStatus();
      window.location.href = '/admin.html';
    } else {
      alert(data.error || '登录失败');
    }
  } catch (error) {
    console.error('登录错误:', error);
    alert('登录请求失败');
  }
};

// 注册功能
window.registerUser = async function(event) {
  event.preventDefault();
  const username = document.getElementById('regUsername').value;
  const password = document.getElementById('regPassword').value;

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    if (data.success) {
      alert('注册成功，请登录');
      window.location.href = '/login.html';
    } else {
      alert(data.error || '注册失败');
    }
  } catch (error) {
    console.error('注册错误:', error);
    alert('注册请求失败');
  }
};

// 退出登录
window.logoutUser = function() {
  localStorage.removeItem('jwtToken');
  checkLoginStatus();
  window.location.href = '/';
};