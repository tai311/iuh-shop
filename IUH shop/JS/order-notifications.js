(function () {
    'use strict';
    if (window.IUHOrderNotifications) return;
    window.IUHOrderNotifications = true;
    const client = window.IUHCore?.getClient?.();
    if (!client) return;
    const tables = ['order_notifications','connection_notifications','price_offer_notifications'];
    const labels = {
        payment_requested:'Đơn hàng mới cần xử lý', payment_approved:'Đơn hàng cần người bán xác nhận',
        seller_fee_due:'Yêu cầu giao dịch mới', request_created:'Yêu cầu mua hàng đã gửi',
        chat_unlocked:'Chat mua bán đã mở', offer_received:'Bạn có đề nghị trả giá mới',
        offer_countered:'Người bán đã đề xuất giá khác', offer_accepted:'Giá trả đã được chấp nhận',
        offer_rejected:'Đề nghị trả giá đã bị từ chối', counter_accepted:'Người mua đã chấp nhận giá đề xuất',
        counter_rejected:'Người mua đã từ chối giá đề xuất', seller_delivered:'Người bán đã xác nhận giao hàng',
        delivery_completed:'Đơn hàng đã hoàn tất', delivered:'Có cập nhật giao hàng',
        completed:'Có cập nhật hoàn tất đơn hàng', cancelled:'Yêu cầu đã được hủy',
        expired:'Yêu cầu đã hết hạn', delivery_chosen:'Phương thức giao hàng đã cập nhật',
        delivery_requested:'Có yêu cầu giao hộ', delivery_arranging:'Đang sắp xếp giao hộ',
        delivery_delivered:'Giao hộ đã hoàn tất'
    };
    const mojibakePattern = /(?:Ã.|Â.|Ä.|Æ.|á»|áº|â€|ï¿½)/g;
    const cp1252Bytes = new Map([[0x20ac,0x80],[0x201a,0x82],[0x0192,0x83],[0x201e,0x84],[0x2026,0x85],[0x2020,0x86],[0x2021,0x87],[0x02c6,0x88],[0x2030,0x89],[0x0160,0x8a],[0x2039,0x8b],[0x0152,0x8c],[0x017d,0x8e],[0x2018,0x91],[0x2019,0x92],[0x201c,0x93],[0x201d,0x94],[0x2022,0x95],[0x2013,0x96],[0x2014,0x97],[0x02dc,0x98],[0x2122,0x99],[0x0161,0x9a],[0x203a,0x9b],[0x0153,0x9c],[0x017e,0x9e],[0x0178,0x9f]]);
    function repairMessage(value) {
        const original=String(value||'');
        if(!mojibakePattern.test(original)) { mojibakePattern.lastIndex=0; return original; }
        mojibakePattern.lastIndex=0;
        try {
            const bytes=[];
            for(const char of original) {
                const code=char.codePointAt(0);
                if(code<=0xff) bytes.push(code);
                else if(cp1252Bytes.has(code)) bytes.push(cp1252Bytes.get(code));
                else return original;
            }
            const decoded=new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(bytes));
            const before=(original.match(mojibakePattern)||[]).length;
            mojibakePattern.lastIndex=0;
            const after=(decoded.match(mojibakePattern)||[]).length;
            mojibakePattern.lastIndex=0;
            return after<before?decoded:original;
        } catch { mojibakePattern.lastIndex=0; return original; }
    }
    let user=null, rows=[], channel=null, pollTimer=null, stopped=false, loading=false, firstLoad=true;
    const seen=new Set();
    const css = '.site-notification-widget{position:relative;display:inline-flex;align-items:center;z-index:1300}' +
      '.site-notification-button{position:relative;width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:12px;background:transparent;color:inherit;font-size:19px;cursor:pointer}' +
      '.site-notification-button:hover,.site-notification-button[aria-expanded=true]{background:rgba(255,255,255,.14);color:#f8c44f}' +
      '.site-notification-badge{position:absolute;right:1px;top:0;min-width:17px;height:17px;padding:0 4px;display:none;align-items:center;justify-content:center;border:2px solid #fff;border-radius:999px;background:#e53946;color:#fff;font:700 10px Arial}' +
      '.site-notification-badge.visible{display:flex}' +
      '.site-notification-menu{position:absolute;right:-72px;top:calc(100% + 8px);width:min(380px,calc(100vw - 28px));max-height:min(70vh,520px);display:flex;flex-direction:column;overflow:hidden;border:1px solid #e5eaf2;border-radius:16px;background:#fff;color:#192642;box-shadow:0 18px 54px #12234638;z-index:5000}' +
      '.site-notification-menu[hidden]{display:none}' +
      '.site-notification-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #edf0f5}' +
      '.site-notification-head strong{font:800 15px Arial,sans-serif;color:#172554}' +
      '.site-notification-markall{border:0;background:none;color:#29449c;font:600 11px Arial,sans-serif;cursor:pointer}' +
      '.site-notification-list{overflow:auto;padding:4px 10px 10px}' +
      '.site-notification-empty{padding:24px 12px;text-align:center;color:#8490a5;font:13px Arial,sans-serif}' +
      '.site-notification-item{position:relative;display:block;margin-top:7px;padding:11px 34px 11px 12px;border-radius:11px;background:#fff;color:inherit;cursor:pointer}' +
      '.site-notification-item:hover{background:#f5f7fb}.site-notification-item.unread{background:#f0f5ff}' +
      '.site-notification-item.unread:before{content:"";position:absolute;left:3px;top:18px;width:6px;height:6px;border-radius:50%;background:#3157b7}' +
      '.site-notification-title{display:block;margin-bottom:4px;color:#243c77;font:700 12px/1.4 Arial,sans-serif}' +
      '.site-notification-message{display:block;color:#4e5c73;font:12px/1.5 Arial,sans-serif;overflow-wrap:anywhere}' +
      '.site-notification-time{display:block;margin-top:5px;color:#9aa4b5;font:10px Arial,sans-serif}' +
      '.site-notification-read{position:absolute;right:8px;top:10px;width:24px;height:24px;border:0;border-radius:7px;background:transparent;color:#7a879a;cursor:pointer}' +
      '.site-notification-read:hover{background:#e5ebf6;color:#29449c}' +
      '.site-notification-toasts{position:fixed;right:18px;bottom:18px;display:grid;gap:10px;width:min(360px,calc(100vw - 32px));z-index:7000;pointer-events:none}' +
      '.site-notification-toast{pointer-events:auto;display:grid;grid-template-columns:36px 1fr 24px;gap:10px;align-items:start;padding:13px;border:1px solid #e2e8f3;border-radius:14px;background:#fff;box-shadow:0 12px 36px #1223462e;animation:siteNotifIn .22s ease-out}' +
      '.site-notification-toast-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:#edf3ff;color:#29449c}' +
      '.site-notification-toast strong{display:block;color:#172554;font:700 12px/1.4 Arial,sans-serif}' +
      '.site-notification-toast span{display:block;margin-top:3px;color:#56647b;font:11px/1.45 Arial,sans-serif}' +
      '.site-notification-toast button{border:0;background:transparent;color:#778398;cursor:pointer}' +
      '@keyframes siteNotifIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}' +
      '@media(max-width:600px){.site-notification-menu{right:-90px}.site-notification-toasts{right:12px;bottom:12px}}' +
      '@media(prefers-reduced-motion:reduce){.site-notification-toast{animation:none}}';
    const style=document.createElement('style'); style.textContent=css; document.head.append(style);
    function target(item) {
        if(item.table==='price_offer_notifications') return 'donhang.html#priceOffers';
        if(item.table==='connection_notifications') {
            if(item.event==='delivery_requested') return 'admin.html#orders';
            if(item.event==='seller_fee_due') return 'donhang.html#connectionRequests';
            return 'donhang.html?watch='+encodeURIComponent(item.request_id||'');
        }
        if(['payment_requested','delivered'].includes(item.event)) return 'admin.html#orders';
        if(item.event==='payment_approved') return 'donhang.html#sale';
        return 'donhang.html';
    }
    function time(value) {
        const d=new Date(value); return Number.isFinite(d.getTime())?d.toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
    }
    function key(item){return item.table+':'+item.id}
    function mount() {
        const cart=document.querySelector('.top-cart-icon');
        if(!cart||document.querySelector('.site-notification-widget')) return;
        const wrap=document.createElement('div'); wrap.className='site-notification-widget';
        const button=document.createElement('button'); button.type='button'; button.className='site-notification-button';
        button.setAttribute('aria-label','Thông báo'); button.setAttribute('aria-expanded','false'); button.title='Thông báo';
        button.innerHTML='<i class="fa-regular fa-bell" aria-hidden="true"></i><span class="site-notification-badge"></span>';
        const menu=document.createElement('section'); menu.className='site-notification-menu'; menu.hidden=true; menu.setAttribute('aria-label','Danh sách thông báo');
        const head=document.createElement('div'); head.className='site-notification-head';
        const title=document.createElement('strong'); title.textContent='Thông báo';
        const all=document.createElement('button'); all.type='button'; all.className='site-notification-markall'; all.textContent='Đánh dấu đã đọc';
        head.append(title,all); const list=document.createElement('div'); list.className='site-notification-list'; menu.append(head,list); wrap.append(button,menu); cart.insertAdjacentElement('afterend',wrap);
        button.addEventListener('click',e=>{e.stopPropagation();menu.hidden=!menu.hidden;button.setAttribute('aria-expanded',String(!menu.hidden))});
        menu.addEventListener('click',e=>e.stopPropagation()); all.addEventListener('click',markAll);
        document.addEventListener('click',closeMenu); document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
    }
    function closeMenu(){const m=document.querySelector('.site-notification-menu'),b=document.querySelector('.site-notification-button');if(m)m.hidden=true;if(b)b.setAttribute('aria-expanded','false')}
    function render(){
        mount(); const badge=document.querySelector('.site-notification-badge'),list=document.querySelector('.site-notification-list');if(!badge||!list)return;
        const count=rows.filter(x=>!x.is_read).length;badge.textContent=count>99?'99+':String(count);badge.classList.toggle('visible',count>0);list.replaceChildren();
        if(!rows.length){const empty=document.createElement('div');empty.className='site-notification-empty';empty.textContent='Bạn chưa có thông báo nào.';list.append(empty);return}
        for(const item of rows){
            const row=document.createElement('article');row.className='site-notification-item'+(item.is_read?'':' unread');row.tabIndex=0;row.setAttribute('role','button');
            const heading=document.createElement('strong');heading.className='site-notification-title';heading.textContent=labels[item.event]||'Cập nhật mới';
            const message=document.createElement('span');message.className='site-notification-message';message.textContent=repairMessage(item.message)||'Bạn có cập nhật mới.';
            const stamp=document.createElement('time');stamp.className='site-notification-time';stamp.textContent=time(item.created_at);row.append(heading,message,stamp);
            row.addEventListener('click',()=>openItem(item));row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openItem(item)}});
            if(!item.is_read){const read=document.createElement('button');read.type='button';read.className='site-notification-read';read.setAttribute('aria-label','Đánh dấu đã đọc');read.innerHTML='<i class="fa-solid fa-check" aria-hidden="true"></i>';read.addEventListener('click',e=>{e.stopPropagation();setRead(item)});row.append(read)}
            list.append(row)
        }
    }
    async function setRead(item){const r=await client.from(item.table).update({is_read:true}).eq('id',item.id).eq('user_id',user.id);if(r.error)return;item.is_read=true;render()}
    async function openItem(item){if(!item.is_read)await setRead(item);window.location.href=target(item)}
    async function markAll(){if(!user)return;const results=await Promise.all(tables.map(t=>client.from(t).update({is_read:true}).eq('user_id',user.id).eq('is_read',false)));results.forEach((result,index)=>{if(!result.error)rows.filter(x=>x.table===tables[index]).forEach(x=>x.is_read=true)});render()}
    function toast(item){
        let holder=document.querySelector('.site-notification-toasts');if(!holder){holder=document.createElement('div');holder.className='site-notification-toasts';holder.setAttribute('aria-live','polite');document.body.append(holder)}
        const card=document.createElement('article');card.className='site-notification-toast';
        const icon=document.createElement('div');icon.className='site-notification-toast-icon';icon.innerHTML='<i class="fa-regular fa-bell" aria-hidden="true"></i>';
        const body=document.createElement('div'),heading=document.createElement('strong'),message=document.createElement('span');heading.textContent=labels[item.event]||'Thông báo mới';message.textContent=repairMessage(item.message)||'Bạn có cập nhật mới.';body.append(heading,message);
        const close=document.createElement('button');close.type='button';close.setAttribute('aria-label','Đóng');close.textContent='×';card.append(icon,body,close);
        const dismiss=()=>card.remove();close.addEventListener('click',dismiss);card.addEventListener('click',e=>{if(e.target!==close)openItem(item)});holder.append(card);setTimeout(dismiss,6500);while(holder.children.length>4)holder.firstElementChild.remove()
    }
    async function refresh(showNew){
        if(loading||stopped||!user||document.hidden)return;loading=true;
        try{
            const result=await Promise.all(tables.map(async t=>{const r=await client.from(t).select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(30);return r.error?[]:(r.data||[]).map(x=>({...x,table:t}))}));
            const next=result.flat().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,60),fresh=[];
            for(const item of next){const k=key(item);if(!seen.has(k)){if(!firstLoad&&showNew&&!item.is_read)fresh.push(item);seen.add(k)}}
            rows=next;render();fresh.slice(0,3).reverse().forEach(toast);firstLoad=false
        }catch{}finally{loading=false}
    }
    function subscribe(){
        if(channel)client.removeChannel(channel);channel=client.channel('site-notifications-'+user.id);
        for(const table of tables){
            channel.on('postgres_changes',{event:'INSERT',schema:'public',table,filter:'user_id=eq.'+user.id},payload=>{const item={...payload.new,table};if(!item.is_read&&!seen.has(key(item))){seen.add(key(item));toast(item)}void refresh(false)});
            channel.on('postgres_changes',{event:'UPDATE',schema:'public',table,filter:'user_id=eq.'+user.id},()=>void refresh(false))
        }
        channel.subscribe()
    }
    async function start(){
        const auth=await window.IUHCore.getUser();user=auth.data?.user||null;
        if(!user){document.querySelector('.site-notification-widget')?.remove();return}
        mount();await refresh(false);subscribe();clearInterval(pollTimer);pollTimer=setInterval(()=>void refresh(true),20000)
    }
    function stop(){if(channel)client.removeChannel(channel);channel=null;clearInterval(pollTimer);rows=[];seen.clear();firstLoad=true;closeMenu();document.querySelector('.site-notification-widget')?.remove()}
    document.addEventListener('DOMContentLoaded',()=>{mount();void start()});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh(true)});
    window.addEventListener('pagehide',()=>{stopped=true;stop()});
    client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){stop();return}if(['SIGNED_IN','TOKEN_REFRESHED','INITIAL_SESSION'].includes(event)){stopped=false;if(event==='SIGNED_IN'){seen.clear();firstLoad=true}void start()}});
})();
