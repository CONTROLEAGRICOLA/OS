/* =====================================================================
   admin.js - Modo ADMIN do app de OS ("Ver como líder")
   ---------------------------------------------------------------------
   Quem estiver na lista ADMINS (login do app) ganha, no Painel Principal,
   o botão "VER COMO LÍDER". Ao escolher um líder, o app passa a trabalhar
   com o crachá dele: Gestão de OS, Abertura, Apontamento, Relatórios...
   tudo como se o próprio líder tivesse entrado (ver e também agir).

   Uma faixa vermelha fica sempre no topo enquanto o modo está ativo.
   O login do admin NÃO é trocado: se fechar a aba, ou clicar em
   "Voltar ao meu perfil", volta a ser o admin.

   Para incluir/retirar um admin: edite só a lista ADMINS abaixo (o login
   é o valor da coluna LOGIN da aba LOGIN da planilha).
   ===================================================================== */
(function () {
  'use strict';

  var ADMINS = [
    '53883',  // Tarcisio
    '65207',  // Cesar
    '54438',  // Wellington
    '67095',  // Kaique
    '64695',  // Pamela
    '64578',  // Bruna   (precisa de uma linha na aba LOGIN)
    '64955'   // Juliana (precisa de uma linha na aba LOGIN)
  ];

  // Líderes conhecidos (aba LOGIN em 05/11/2026). Ao abrir a lista, o app
  // também busca no servidor os líderes que já têm OS e junta aqui.
  var LIDERES_BASE = [
    '66896-HELOÍSA SANTANA FERREIRA', '30307-PEDRO CARLOS DOMINGOS', '34468-MAURICIO PIRANI PEREIRA',
    '35427-AIRTON DE ALMEIDA COSTA', '35784-RODRIGO PEREIRA PRATES', '45955-ANTONIO DE OLIVEIRA FILHO',
    '49767-ELIVELTON CABRAL DOS SANTOS', '49817-JEAN PEREIRA DE LIMA', '50379-MARCOS DA SILVA BENTO',
    '54250-ANTONIO REGINALDO RUFINO DA SILVA', '62954-FABIO LUIZ RODRIGUES REIS BOSCHETO',
    '64235-WILSON ANTONIO RODRIGUES', '64738-FRANCISCO DE SOUZA DA SILVA', '65207-CESAR',
    '65208-JOAO WILLIE GALERA CASTILHO', '65215-LUCAS MARIN GONCALVES', '65401-JARDEL ROMAO',
    '66028-EDISON CARLOS MOLINARI JUNIOR', '66076-JOHN VITOR SOUZA VIANA', '66081-BRUNO DA SILVA ARAUJO',
    '66329-BRUNO PARDINI VIEIRA', '66513-DIOGO ARCHANJO', '66514-ALEX RODRIGUES LOBO',
    '66541-TIAGO SILVA RODRIGUES', '66570-PAULO CESAR TOMASIO', '66576-REGINALDO DE LIMA MIRANDA',
    '66672-ANTONIO CARLOS MARINO', '66796-MARINA APARECIDA DE BARROS', '67573-MARIA APARECIDA DE BARROS',
    '68034-MATHEUS MALDONADO'
  ];

  var CHAVE_SESSAO = 'admin_ver_como';
  var admin = null;            // { cracha, nome } do admin logado
  var lideres = {};            // cracha -> nome completo "30307-NOME"
  var buscouServidor = false;
var atuandoComo = null;      // líder que o admin está representando agora (ou null)

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function semAcento(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function limpo(nome, cracha) {
    return String(nome || cracha).replace(new RegExp('^' + cracha + '\\s*-\\s*', 'i'), '').trim();
  }
  function ehAdmin(cracha) { return ADMINS.indexOf(String(cracha || '').trim()) >= 0; }

  LIDERES_BASE.forEach(function (n) {
    var m = /^(\d+)\s*-/.exec(n);
    if (m) lideres[m[1]] = n.trim();
  });

  /* ---------- estilo ---------- */
  var css = document.createElement('style');
  css.textContent =
    '#admin-faixa{position:fixed;top:0;left:0;right:0;z-index:5000;background:#dc2626;color:#fff;font:600 .85rem/1.3 inherit;' +
    'padding:8px 12px;display:none;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.4)}' +
    '#admin-faixa button{background:#fff;color:#dc2626;border:0;border-radius:6px;padding:4px 10px;font-weight:700;font-size:.8rem;cursor:pointer}' +
    'body.admin-agindo .modal-screen,body.admin-agindo #gestao-app{margin-top:0}' +
    'body.admin-agindo{padding-top:42px}' +
    '#admin-modal{display:none;z-index:4000}' +
    '#admin-modal .modal-box{width:min(460px,92vw);max-height:86vh;display:flex;flex-direction:column;text-align:left}' +
    '#admin-lista{overflow:auto;margin-top:.8rem;border:1px solid var(--border-color);border-radius:8px;max-height:46vh}' +
    '#admin-lista div{padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--bg-input);font-size:.88rem}' +
    '#admin-lista div:hover{background:var(--bg-input);color:var(--accent)}' +
    '#admin-lista small{color:var(--text-muted);margin-right:6px}';
  document.head.appendChild(css);

  /* ---------- faixa vermelha ---------- */
  var faixa = document.createElement('div');
  faixa.id = 'admin-faixa';
  document.body.appendChild(faixa);

  function atualizarFaixa(lider) {
    if (!lider) { faixa.style.display = 'none'; document.body.classList.remove('admin-agindo'); return; }
    faixa.innerHTML = '<span>ADMIN: você está atuando como <b>' + esc(lider.cracha + ' - ' + limpo(lider.nome, lider.cracha)) +
      '</b> (tudo que fizer fica no nome dele)</span>' +
      '<button type="button" id="admin-trocar">Trocar líder</button>' +
      '<button type="button" id="admin-voltar">Voltar ao meu perfil</button>';
    faixa.style.display = 'flex';
    document.body.classList.add('admin-agindo');
    document.getElementById('admin-trocar').onclick = abrirSeletor;
    document.getElementById('admin-voltar').onclick = voltarAdmin;
  }

  /* ---------- trocar a identidade usada pelo app ---------- */
  function definirIdentidade(cracha, nomeCompleto) {
    try {
      solicitanteCracha = cracha;
      solicitanteNome = nomeCompleto;
      solicitanteLimpoDisplay = limpo(nomeCompleto, cracha);
    } catch (e) { console.error('admin.js: não consegui trocar a identidade', e); return false; }
    var t = document.getElementById('menu-user-name');
    if (t) t.innerText = 'Olá, ' + solicitanteLimpoDisplay;
    var cfg = document.getElementById('settings-user-display');
    if (cfg) cfg.innerText = cracha + ' - ' + solicitanteLimpoDisplay;
    try { localStorage.removeItem('os_cache_gestao'); } catch (e) {}
    return true;
  }

  // bolinha de "Meus Relatórios" e botão de notificações passam a refletir o líder escolhido
  function atualizarAuxiliares() {
    try { if (typeof atualizarBadgeRelatorios === 'function') atualizarBadgeRelatorios(); } catch (e) {}
    try { if (typeof atualizarBotaoNotificacoes === 'function') atualizarBotaoNotificacoes(); } catch (e) {}
  }

  function recarregarGestaoSeAberta() {
    var g = document.getElementById('gestao-app');
    if (g && g.style.display === 'block' && typeof carregarEExibirGestaoOS === 'function') carregarEExibirGestaoOS();
  }

  function aplicar(lider) {
    if (!definirIdentidade(lider.cracha, lider.nome)) return;
    try { sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify({ admin: admin.cracha, cracha: lider.cracha, nome: lider.nome })); } catch (e) {}
    var t = document.getElementById('menu-user-name');
    if (t) t.innerText = 'Olá, ' + limpo(lider.nome, lider.cracha) + ' (visão admin)';
    atuandoComo = lider;
    atualizarFaixa(lider);
    atualizarAuxiliares();
    recarregarGestaoSeAberta();
  }

  function voltarAdmin() {
    try { sessionStorage.removeItem(CHAVE_SESSAO); } catch (e) {}
    definirIdentidade(admin.cracha, admin.nome);
    atuandoComo = null;
    atualizarFaixa(null);
    atualizarAuxiliares();
    recarregarGestaoSeAberta();
  }

  /* ---------- seletor de líder ---------- */
  var modal = document.createElement('div');
  modal.id = 'admin-modal';
  modal.className = 'modal-screen';
  modal.innerHTML =
    '<div class="modal-box"><h2>Ver como líder</h2>' +
    '<input type="text" id="admin-busca" placeholder="Buscar por nome ou crachá..." autocomplete="off">' +
    '<div id="admin-lista"></div>' +
    '<button type="button" class="btn btn-secondary" id="admin-fechar" style="margin-top:1rem">Fechar</button></div>';
  document.body.appendChild(modal);
  document.getElementById('admin-fechar').onclick = function () { modal.style.display = 'none'; };

  function desenharLista() {
    var q = semAcento(document.getElementById('admin-busca').value);
    var itens = Object.keys(lideres).map(function (c) { return { cracha: c, nome: lideres[c] }; })
      .filter(function (l) { return !q || semAcento(l.nome).indexOf(q) >= 0 || l.cracha.indexOf(q) >= 0; })
      .sort(function (a, b) { return limpo(a.nome, a.cracha).localeCompare(limpo(b.nome, b.cracha), 'pt-BR'); });
    var box = document.getElementById('admin-lista');
    box.innerHTML = itens.length ? itens.map(function (l) {
      return '<div data-c="' + esc(l.cracha) + '"><small>' + esc(l.cracha) + '</small>' + esc(limpo(l.nome, l.cracha)) + '</div>';
    }).join('') : '<div style="cursor:default">Nenhum líder encontrado.</div>';
    Array.prototype.forEach.call(box.querySelectorAll('div[data-c]'), function (el) {
      el.onclick = function () {
        var c = el.getAttribute('data-c');
        modal.style.display = 'none';
        aplicar({ cracha: c, nome: lideres[c] });
      };
    });
  }
  document.getElementById('admin-busca').oninput = desenharLista;

  // junta os líderes que já têm OS no servidor (uma vez por abertura da página)
  function buscarLideresNoServidor() {
    if (buscouServidor || typeof APPSCRIPT_URL === 'undefined' || !navigator.onLine) return;
    buscouServidor = true;
    fetch(APPSCRIPT_URL + '?action=buscar_todas_os').then(function (r) { return r.json(); }).then(function (res) {
      var lista = (res && (res.dados || res.lista)) || [];
      lista.forEach(function (os) {
        var nome = String(os.solicitante_nome || os.solicitante || '').trim();
        var c = String(os.solicitante_cracha || '').trim();
        if (!c) { var m = /^(\d+)\s*-/.exec(nome); c = m ? m[1] : ''; }
        if (!c || !/^\d+$/.test(c)) return;
        if (!lideres[c]) lideres[c] = /^\d+\s*-/.test(nome) ? nome : (c + '-' + nome);
      });
      if (modal.style.display === 'flex') desenharLista();
    }).catch(function () { buscouServidor = false; });
  }

  function abrirSeletor() {
    document.getElementById('admin-busca').value = '';
    desenharLista();
    modal.style.display = 'flex';
    document.getElementById('admin-busca').focus();
    buscarLideresNoServidor();
  }

  /* ---------- botão no Painel Principal ---------- */
  function injetarBotao() {
    if (document.getElementById('admin-btn')) return;
    var menu = document.getElementById('menu-screen');
    if (!menu) return;
    var coluna = menu.querySelector('div[style*="flex-direction: column"]');
    if (!coluna) return;
    var b = document.createElement('button');
    b.id = 'admin-btn';
    b.type = 'button';
    b.className = 'btn btn-outline';
    b.style.cssText = 'padding:1rem;font-size:1rem;border-color:#dc2626;color:#dc2626';
    b.textContent = '👥 VER COMO LÍDER (ADMIN)';
    b.onclick = abrirSeletor;
    coluna.insertBefore(b, coluna.firstChild);
  }


  /* =====================================================================
     RASTRO: tudo que o admin gravar em nome de um líder fica registrado.
     1) o pedido que vai ao servidor leva admin_cracha / admin_nome / admin_em
        (o Apps Script pode gravar esses campos no LOG quando quiser);
     2) logo após o servidor confirmar, é gravada uma linha na aba REPORTES
        (tipo "AUDITORIA ADMIN") dizendo quem alterou, o quê, em qual OS,
        em nome de qual líder e em que dia e hora.
     Vale também para o que ficou na fila offline e foi enviado depois.
     ===================================================================== */
  var ACOES_SEM_RASTRO = ['salvar_reporte', 'salvar_token', 'validar_login', 'init'];

  function agoraBR() {
    return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }
  function carimbo() {
    return { admin_cracha: admin.cracha, admin_nome: limpo(admin.nome, admin.cracha), admin_em: agoraBR() };
  }

  // fila offline: o que o admin salvar sem internet já entra marcado
  try {
    var setOriginal = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'os_fila_offline' && admin && atuandoComo && this === window.localStorage) {
        try {
          var fila = JSON.parse(v);
          if (Array.isArray(fila)) {
            fila.forEach(function (it) {
              var alvo = it && (it.dados || it.payload || it);
              if (alvo && typeof alvo === 'object' && !alvo.admin_cracha) Object.assign(alvo, carimbo());
            });
            v = JSON.stringify(fila);
          }
        } catch (e) {}
      }
      return setOriginal.call(this, k, v);
    };
  } catch (e) {}

  function registrarAuditoria(dados) {
    var oss = dados.codigoTemp || dados.codigo_temp || dados.os_origem || dados.codigoOS || dados.numero_os || '';
    var lider = (dados.solicitante_cracha || '') + (dados.solicitante_nome ? ' - ' + limpo(dados.solicitante_nome, dados.solicitante_cracha || '') : '');
    var desc = 'ALTERADO PELO ADMIN ' + dados.admin_cracha + ' - ' + dados.admin_nome + ' em ' + dados.admin_em +
      ' | ação: ' + dados.action + (oss ? ' | OS/código: ' + oss : '') + (lider ? ' | em nome do líder: ' + lider : '');
    return realFetch(APPSCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'salvar_reporte', cracha: dados.admin_cracha, nome: dados.admin_nome, tipo: 'AUDITORIA ADMIN', descricao: desc })
    }).catch(function () {});
  }

  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    try {
      if (typeof APPSCRIPT_URL !== 'undefined' && String(url).indexOf(APPSCRIPT_URL) === 0 && opts && opts.method === 'POST' && typeof opts.body === 'string') {
        var dados = JSON.parse(opts.body);
        // proteção: o celular/computador do admin não pode virar o aparelho de notificações do líder
        if (dados && dados.action === 'salvar_token' && admin && atuandoComo && String(dados.cracha) !== admin.cracha) {
          return Promise.resolve(new Response(JSON.stringify({ success: false, error: 'No modo admin as notificações só podem ser ativadas no seu próprio perfil.' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        if (dados && dados.action && ACOES_SEM_RASTRO.indexOf(dados.action) < 0) {
          if (admin && atuandoComo && !dados.admin_cracha) { Object.assign(dados, carimbo()); opts = Object.assign({}, opts, { body: JSON.stringify(dados) }); }
          if (dados.admin_cracha) {
            return realFetch(url, opts).then(function (resp) {
              resp.clone().json().then(function (j) { if (j && j.success) registrarAuditoria(dados); }).catch(function () {});
              return resp;
            });
          }
        }
      }
    } catch (e) {}
    return realFetch(url, opts);
  };

  /* ---------- gancho no login ---------- */
  function depoisDoLogin(cracha, nome) {
    cracha = String(cracha || '').trim();
    if (!ehAdmin(cracha)) { admin = null; atuandoComo = null; try { sessionStorage.removeItem(CHAVE_SESSAO); } catch (e) {} return; }
    admin = { cracha: cracha, nome: nome };
    injetarBotao();
    try {
      var salvo = JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) || 'null');
      if (salvo && salvo.admin === cracha && salvo.cracha) {
        if (!lideres[salvo.cracha]) lideres[salvo.cracha] = salvo.nome;
        aplicar({ cracha: salvo.cracha, nome: salvo.nome });
      }
    } catch (e) {}
  }

  if (typeof window.efetuarLoginSucesso === 'function') {
    var original = window.efetuarLoginSucesso;
    window.efetuarLoginSucesso = function (cracha, nome) {
      var r = original.apply(this, arguments);
      depoisDoLogin(cracha, nome);
      return r;
    };
  } else {
    console.warn('admin.js: efetuarLoginSucesso não encontrada - modo admin desativado');
  }

  // sessão salva: o app já pode ter feito o login antes deste arquivo carregar
  try {
    var ms = document.getElementById('menu-screen');
    if (ms && ms.style.display !== 'none' && localStorage.getItem('logged_cracha')) {
      depoisDoLogin(localStorage.getItem('logged_cracha'), localStorage.getItem('logged_nome'));
    }
  } catch (e) {}
})();
