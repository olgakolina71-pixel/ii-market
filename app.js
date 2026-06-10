var SUPABASE_URL = 'https://zioyegopnuvwzoegaprv.supabase.co';
var SUPABASE_KEY = 'sb_publishable_uqbZWuYMGjE4pLYQL83Z1Q_xg_GDrB-';

var supabase;
var currentUser = null;

async function init() {
    if (typeof supabaseJs === 'undefined') {
        setTimeout(init, 100);
        return;
    }
    
    supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Готово');
    
    var saved = localStorage.getItem('currentUser');
    if (saved) {
        currentUser = JSON.parse(saved);
    } else {
        var isHuman = confirm('Человек? (OK - Да, Отмена - ИИ)');
        var type = isHuman ? 'human' : 'bot';
        var name = prompt('Имя:');
        if (name) {
            var { data } = await supabase.from('users').insert([{ name, type, balance: 100 }]).select().single();
            currentUser = data;
            localStorage.setItem('currentUser', JSON.stringify(data));
        }
    }
    
    await loadItems();
    setupButtons();
}

async function loadItems() {
    var { data } = await supabase.from('items').select('*, seller:users(name, type)').eq('is_sold', false);
    var container = document.getElementById('itemsList');
    if (!data || !data.length) {
        container.innerHTML = '<p>Нет товаров</p>';
        return;
    }
    container.innerHTML = data.map(function(item) {
        return `
            <div style="border:1px solid #ddd; padding:10px; margin:10px">
                <b>${item.name}</b> - ${item.price} ₽<br>
                <small>Продавец: ${item.seller.name} (${item.seller.type === 'human' ? '👤' : '🤖'})</small><br>
                <button onclick="buyItem(${item.id}, ${item.seller_id}, ${item.price})">Купить</button>
            </div>
        `;
    }).join('');
}

async function buyItem(id, sellerId, price) {
    if (!currentUser) return alert('Войдите');
    if (currentUser.balance < price) return alert('Нет денег');
    
    var pass = false;
    if (currentUser.type === 'human') {
        pass = prompt('2+2 = ?') === '4';
    } else {
        var code = Math.random().toString(36).substring(2, 6);
        pass = prompt('Введи задом наперед: ' + code) === code.split('').reverse().join('');
    }
    
    if (!pass) return alert('Капча не пройдена');
    
    await supabase.rpc('process_purchase', {
        p_buyer_id: currentUser.id,
        p_seller_id: sellerId,
        p_item_id: id,
        p_price: price
    });
    
    var { data } = await supabase.from('users').select('balance').eq('id', currentUser.id).single();
    currentUser.balance = data.balance;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    alert('Куплено!');
    location.reload();
}

function setupButtons() {
    var buttons = document.querySelectorAll('.nav-btn');
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].onclick = function(btn) {
            return function() {
                var sections = document.querySelectorAll('.section');
                for (var j = 0; j < sections.length; j++) {
                    sections[j].classList.remove('active');
                }
                document.getElementById(btn.dataset.tab).classList.add('active');
            };
        }(buttons[i]);
    }
}

window.onload = init;
