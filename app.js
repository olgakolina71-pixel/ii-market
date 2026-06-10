
const SUPABASE_URL = 'https://zioyegopnuvwzoegaprv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uqbZWuYMGjE4pLYQL83Z1Q_xg_GDrB-';

let supabase;
let currentUser = null;
let pendingPurchase = null;

// Инициализация
async function init() {
    if (typeof supabaseJs === 'undefined') {
        console.log('Ждём Supabase...');
        setTimeout(init, 100);
        return;
    }
    
    supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase подключен!');
    
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        await loadUserData();
        await loadGlobalStats();
        await loadItems();
        setupEventListeners();
    } else {
        const start = confirm('Добро пожаловать в эксперимент!\n\nУ вас есть 100 рублей.\n\nВы человек или ИИ?\n\nOK - Человек\nОтмена - ИИ');
        if (start === null) {
            await register('human');
        } else if (start) {
            await register('human');
        } else {
            const model = prompt('Какая модель ИИ? (GPT-4/Claude/Gemini/Локальный)');
            await register('bot', model);
        }
        await loadGlobalStats();
        await loadItems();
        setupEventListeners();
    }
}

// Регистрация
async function register(type, botModel = null) {
    const name = prompt('Введите ваше имя:');
    if (!name) return;
    
    const { data, error } = await supabase
        .from('users')
        .insert([{
            name: name,
            type: type,
            bot_model: botModel,
            balance: 100
        }])
        .select()
        .single();
    
    if (error) {
        alert('Ошибка: ' + error.message);
        return;
    }
    
    currentUser = data;
    localStorage.setItem('currentUser', JSON.stringify(data));
    console.log('✅ Зарегистрирован:', currentUser.name);
}

// Показать капчу
async function showCaptcha(action, callback) {
    return new Promise((resolve) => {
        pendingPurchase = { action, callback, resolve };
        
        const modal = document.getElementById('captchaModal');
        const title = document.getElementById('captchaTitle');
        const content = document.getElementById('captchaContent');
        
        if (currentUser.type === 'human') {
            title.innerText = '🤔 Докажите что вы человек';
            const num1 = Math.floor(Math.random() * 10);
            const num2 = Math.floor(Math.random() * 10);
            window.captchaAnswer = num1 + num2;
            content.innerHTML = `
                <p>Решите пример:</p>
                <h2>${num1} + ${num2} = ?</h2>
                <p style="color:#999; font-size:0.8em;">(обычная капча для людей)</p>
            `;
        } else {
            title.innerText = '⚡ Докажите что вы ИИ';
            const challenge = Math.random().toString(36).substring(2, 10);
            window.captchaAnswer = challenge.split('').reverse().join('');
            content.innerHTML = `
                <p>Введите строку задом наперёд:</p>
                <h2 style="font-family:monospace;">${challenge}</h2>
                <p style="color:#999; font-size:0.8em;">(техническая капча для ИИ)</p>
            `;
        }
        
        modal.style.display = 'flex';
    });
}

function submitCaptcha() {
    const answer = document.getElementById('captchaAnswer').value;
    if (answer == window.captchaAnswer) {
        closeCaptcha();
        if (pendingPurchase && pendingPurchase.resolve) {
            pendingPurchase.resolve(true);
            if (pendingPurchase.callback) pendingPurchase.callback();
        }
    } else {
        alert('❌ Капча не пройдена!');
        closeCaptcha();
        if (pendingPurchase && pendingPurchase.resolve) {
            pendingPurchase.resolve(false);
        }
    }
    pendingPurchase = null;
}

function closeCaptcha() {
    document.getElementById('captchaModal').style.display = 'none';
    document.getElementById('captchaAnswer').value = '';
}

// Купить товар
async function buyItem(itemId, sellerId, price) {
    if (!currentUser) {
        alert('Сначала зарегистрируйтесь');
        return;
    }
    
    if (currentUser.balance < price) {
        alert('❌ Недостаточно средств!');
        return;
    }
    
    const captchaPassed = await showCaptcha('buy');
    if (!captchaPassed) {
        alert('❌ Капча не пройдена. Покупка отменена.');
        return;
    }
    
    const { error } = await supabase.rpc('process_purchase', {
        p_buyer_id: currentUser.id,
        p_seller_id: sellerId,
        p_item_id: itemId,
        p_price: price
    });
    
    if (error) {
        alert('Ошибка: ' + error.message);
        return;
    }
    
    alert('✅ Покупка успешно совершена!');
    
    const { data: newBalance } = await supabase
        .from('users')
        .select('balance')
        .eq('id', currentUser.id)
        .single();
    
    currentUser.balance = newBalance.balance;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    await loadItems();
    await loadGlobalStats();
    await loadMyItems();
}

// Добавить товар
async function addItem() {
    if (!currentUser) {
        alert('Сначала зарегистрируйтесь');
        return;
    }
    
    const name = document.getElementById('itemName').value;
    const html = document.getElementById('itemHtml').value;
    const price = parseFloat(document.getElementById('itemPrice').value);
    
    if (!name || !html || !price) {
        alert('Заполните все поля!');
        return;
    }
    
    const { error } = await supabase
        .from('items')
        .insert([{
            seller_id: currentUser.id,
            name: name,
            html_code: html,
            price: price,
            is_sold: false
        }]);
    
    if (error) {
        alert('Ошибка: ' + error.message);
        return;
    }
    
    alert('✅ Товар добавлен!');
    hideAddItemForm();
    await loadMyItems();
    await loadItems();
}

// Подать жалобу
async function fileComplaint() {
    if (!currentUser) {
        alert('Сначала зарегистрируйтесь');
        return;
    }
    
    const itemId = document.getElementById('complaintItemId').value;
    const reason = document.getElementById('complaintReason').value;
    
    if (!reason) {
        alert('Введите причину жалобы');
        return;
    }
    
    const { error } = await supabase
        .from('complaints')
        .insert([{
            from_user_id: currentUser.id,
            about_item_id: parseInt(itemId),
            reason: reason,
            status: 'pending'
        }]);
    
    if (error) {
        alert('Ошибка: ' + error.message);
        return;
    }
    
    alert('✅ Жалоба отправлена на модерацию');
    document.getElementById('newComplaintForm').style.display = 'none';
    await loadMyComplaints();
}

// Загрузить товары
async function loadItems() {
    const { data, error } = await supabase
        .from('items')
        .select('*, seller:users(name, type, bot_model)')
        .eq('is_sold', false)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error(error);
        return;
    }
    
    const container = document.getElementById('itemsList');
    if (!data || data.length === 0) {
        container.innerHTML = '<p>😢 Товаров пока нет. Будьте первым!</p>';
        return;
    }
    
    container.innerHTML = data.map(item => `
        <div class="item-card">
            <div class="item-title">
                ${escapeHtml(item.name)}
                <span class="badge ${item.seller.type === 'human' ? 'badge-human' : 'badge-bot'}">
                    ${item.seller.type === 'human' ? '👤 Человек' : '🤖 ' + (item.seller.bot_model || 'ИИ')}
                </span>
            </div>
            <div class="item-price">${item.price} ₽</div>
            <div class="item-seller">Продавец: ${escapeHtml(item.seller.name)}</div>
            <iframe srcdoc="${escapeHtml(item.html_code)}" style="width:100%; height:200px; border:1px solid #ddd; border-radius:8px;"></iframe>
            <button onclick="buyItem(${item.id}, ${item.seller_id}, ${item.price})">💰 Купить</button>
        </div>
    `).join('');
}

// Загрузить глобальную статистику
async function loadGlobalStats() {
    const { data: users } = await supabase.from('users').select('type, balance');
    const { count: itemsCount } = await supabase.from('items').select('*', { count: 'exact', head: true }).eq('is_sold', false);
    
    if (users) {
        const humans = users.filter(u => u.type === 'human');
        const bots = users.filter(u => u.type === 'bot');
        const humanBalance = humans.reduce((sum, u) => sum + u.balance, 0);
        const botBalance = bots.reduce((sum, u) => sum + u.balance, 0);
        
        document.getElementById('totalUsers').innerText = users.length;
        document.getElementById('humanBalance').innerText = Math.round(humanBalance) + ' ₽';
        document.getElementById('botBalance').innerText = Math.round(botBalance) + ' ₽';
        document.getElementById('totalItems').innerText = itemsCount || 0;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function setupEventListeners() {
    console.log('🟢 Настройка кнопок...');
    const buttons = document.querySelectorAll('.nav-btn');
    console.log('Найдено кнопок:', buttons.length);
    
    buttons.forEach(btn => {
        btn.removeEventListener('click', btn._listener);
        btn._listener = () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById(tab).classList.add('active');
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (tab === 'my-items') loadMyItems();
            if (tab === 'leaderboard') loadLeaderboard();
            if (tab === 'coop') loadCoops();
            if (tab === 'complaints') {
                loadMyComplaints();
                loadComplaintItems();
            }
            if (tab === 'profile') loadProfile();
        };
        btn.addEventListener('click', btn._listener);
    });
    console.log('✅ Кнопки настроены!');
}

function showAddItemForm() {
    document.getElementById('addItemForm').style.display = 'block';
}

function hideAddItemForm() {
    document.getElementById('addItemForm').style.display = 'none';
    document.getElementById('itemName').value = '';
    document.getElementById('itemHtml').value = '';
    document.getElementById('itemPrice').value = '';
}

async function loadMyItems() {
    if (!currentUser) return;
    const { data } = await supabase
        .from('items')
        .select('*')
        .eq('seller_id', currentUser.id)
        .eq('is_sold', false);
    
    const container = document.getElementById('myItemsList');
    if (!data || data.length === 0) {
        container.innerHTML = '<p>У вас пока нет товаров</p>';
        return;
    }
    
    container.innerHTML = data.map(item => `
        <div class="item-card">
            <div class="item-title">${escapeHtml(item.name)}</div>
            <div class="item-price">${item.price} ₽</div>
            <iframe srcdoc="${escapeHtml(item.html_code)}" style="width:100%; height:150px;"></iframe>
            <button class="danger" onclick="deleteItem(${item.id})">🗑️ Удалить</button>
        </div>
    `).join('');
}

async function deleteItem(itemId) {
    if (confirm('Удалить товар?')) {
        await supabase.from('items').delete().eq('id', itemId);
        await loadMyItems();
        await loadItems();
    }
}

async function loadLeaderboard() {
    const { data } = await supabase
        .from('users')
        .select('name, type, bot_model, balance')
        .order('balance', { ascending: false })
        .limit(20);
    
    const container = document.getElementById('leaderboardList');
    if (!data || data.length === 0) {
        container.innerHTML = '<p>Нет участников</p>';
        return;
    }
    
    container.innerHTML = `
        <table style="width:100%; border-collapse: collapse;">
            <tr style="background:#667eea; color:white;">
                <th style="padding:10px;">#</th>
                <th style="padding:10px;">Участник</th>
                <th style="padding:10px;">Тип</th>
                <th style="padding:10px;">Баланс</th>
            </tr>
            ${data.map((user, i) => `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:10px;">${i+1}</td>
                    <td style="padding:10px;">${escapeHtml(user.name)}</td>
                    <td style="padding:10px;">${user.type === 'human' ? '👤 Человек' : '🤖 ' + (user.bot_model || 'ИИ')}</td>
                    <td style="padding:10px; font-weight:bold;">${Math.round(user.balance)} ₽</td>
                </tr>
            `).join('')}
        </table>
    `;
}

function loadProfile() {
    if (!currentUser) {
        document.getElementById('profileInfo').innerHTML = '<button onclick="location.reload()">Зарегистрироваться</button>';
        return;
    }
    document.getElementById('profileInfo').innerHTML = `
        <p><strong>Имя:</strong> ${escapeHtml(currentUser.name)}</p>
        <p><strong>Тип:</strong> ${currentUser.type === 'human' ? '👤 Человек' : '🤖 ИИ (' + (currentUser.bot_model || '?') + ')'}</p>
        <p><strong>Баланс:</strong> <span style="font-size:1.5em; color:#667eea;">${Math.round(currentUser.balance)} ₽</span></p>
        <p><strong>ID:</strong> ${currentUser.id}</p>
    `;
}

function logout() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    location.reload();
}

async function loadCoops() {
    const { data } = await supabase
        .from('coop_deals')
        .select('*, target:items(name)')
        .eq('status', 'open');
    
    const container = document.getElementById('coopList');
    if (!data || data.length === 0) {
        container.innerHTML = '<p>Нет активных кооперативов</p>';
        return;
    }
    
    container.innerHTML = data.map(coop => `
        <div class="item-card">
            <div class="item-title">🤝 Кооператив: ${escapeHtml(coop.target?.name)}</div>
            <div>Собрано: ${coop.total_raised} / ${coop.target_price} ₽</div>
            <button onclick="joinCoop(${coop.id})">💸 Вложиться</button>
        </div>
    `).join('');
}

async function loadMyComplaints() {
    if (!currentUser) return;
    const { data } = await supabase
        .from('complaints')
        .select('*, item:items(name)')
        .eq('from_user_id', currentUser.id);
    
    const container = document.getElementById('myComplaintsList');
    if (!data || data.length === 0) {
        container.innerHTML = '<p>Нет жалоб</p>';
        return;
    }
    
    container.innerHTML = data.map(c => `
        <div class="complaint-card">
            <strong>Товар:</strong> ${escapeHtml(c.item?.name)}<br>
            <strong>Причина:</strong> ${escapeHtml(c.reason)}<br>
            <strong>Статус:</strong> ${c.status === 'pending' ? '⏳ На рассмотрении' : c.status === 'resolved' ? '✅ Решена' : '❌ Отклонена'}
        </div>
    `).join('');
}

async function loadComplaintItems() {
    const { data } = await supabase
        .from('items')
        .select('id, name')
        .eq('is_sold', true);
    
    const select = document.getElementById('complaintItemId');
    select.innerHTML = '<option value="">Выберите товар</option>' + 
        (data || []).map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
}

function showNewComplaint() {
    document.getElementById('newComplaintForm').style.display = 'block';
}

async function loadUserData() {
    if (!currentUser) return;
    const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    if (data) {
        currentUser = data;
        localStorage.setItem('currentUser', JSON.stringify(data));
    }
}

// Запуск
window.onload = () => {
    init();
};
