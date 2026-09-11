// =========================================================================
// GOOGLE APPS SCRIPT BACKEND PARA ORDEM DE SERVIÇO
// NOME DA PLANILHA: DB - ORDEM DE SERVIÇO
// ABAS NECESSÁRIAS: "DB - LANCAMENTO", "TALHAO", "INSUMOS", "EQUIPAMENTOS"
// =========================================================================

// Substitua pelo ID da sua planilha (aquela string enorme na URL)
const SPREADSHEET_ID = '1quTQdNPQUAggmUalAWvtGZMckF_Bx0LLdfG-U_BOiPY';

// Manipula requisições GET (Para Login e Buscar os dados das abas)
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'login') {
    // Simulando login simples - Em um cenário real você checaria uma aba "USUARIOS"
    const user = e.parameter.user;
    if(user && user.length > 2) {
      return respostaJSON({
        success: true,
        dados: {
          fazendas: buscarFazendasETalhoes(),
          insumos: buscarInsumos(),
          equipamentos: buscarEquipamentos()
        }
      });
    } else {
      return respostaJSON({ success: false, error: 'Usuário inválido' });
    }
  }
  
  return respostaJSON({ success: false, error: 'Ação não especificada' });
}

// Manipula requisições POST (Quando o formulário envia os dados para salvar)
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('DB - LANCAMENTO');
    if (!sheet) throw new Error("Aba 'DB - LANCAMENTO' não encontrada.");

    const payload = JSON.parse(e.postData.contents);
    const dataAtual = new Date();
    
    // O payload.produtos é um array. Para cada produto, vamos criar uma linha na planilha.
    // Assim o banco de dados fica estruturado corretamente (uma linha por insumo aplicado)
    if (payload.produtos && payload.produtos.length > 0) {
      payload.produtos.forEach(prod => {
        sheet.appendRow([
          dataAtual, // Timestamp do envio
          payload.tipo_solicitacao,
          payload.encerrar_os,
          payload.data_execucao,
          payload.data_previsao,
          payload.fazenda,
          payload.pea,
          payload.tipo_fazenda,
          payload.zona,
          payload.area_total,
          payload.centro_custo,
          payload.operacao,
          payload.frota,
          payload.tipo_equip,
          payload.talhoes,
          prod.cod,
          prod.desc,
          prod.un,
          prod.dose,
          prod.total,
          payload.solicitante,
          payload.observacoes
        ]);
      });
    } else {
      // Se não tiver produto, salva pelo menos a operação
      sheet.appendRow([
        dataAtual, payload.tipo_solicitacao, payload.encerrar_os, payload.data_execucao, 
        payload.data_previsao, payload.fazenda, payload.pea, payload.tipo_fazenda, 
        payload.zona, payload.area_total, payload.centro_custo, payload.operacao, 
        payload.frota, payload.tipo_equip, payload.talhoes, "-", "-", "-", "-", "-", 
        payload.solicitante, payload.observacoes
      ]);
    }

    return respostaJSON({ success: true });
  } catch (err) {
    return respostaJSON({ success: false, error: err.toString() });
  }
}

// Helper para retornar JSON com CORS liberado
function respostaJSON(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- FUNÇÕES DE BUSCA NAS ABAS ---

// Busca na aba TALHAO e agrupa por Fazenda
// Espera-se as colunas: Fazenda (A), Talhao (B), Area (C), Tipo Fazenda (D), Zona (E)
function buscarFazendasETalhoes() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('TALHAO');
  if(!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const fazendasMap = {};
  
  // Pula o cabeçalho (i=1)
  for (let i = 1; i < data.length; i++) {
    const nomeFazenda = data[i][0];
    const talhao = data[i][1];
    const area = data[i][2];
    const tipo = data[i][3];
    const zona = data[i][4];
    
    if(!nomeFazenda) continue;
    
    if (!fazendasMap[nomeFazenda]) {
      fazendasMap[nomeFazenda] = {
        descricao: nomeFazenda,
        tipo: tipo || "",
        zona: zona || "",
        talhoes: []
      };
    }
    
    if(talhao) {
      fazendasMap[nomeFazenda].talhoes.push({
        talhao: talhao.toString(),
        area: parseFloat(area) || 0
      });
    }
  }
  
  // Converte objeto para array
  return Object.keys(fazendasMap).map(k => fazendasMap[k]);
}

// Busca na aba INSUMOS
// Espera-se: Codigo (A), Descricao (B), Unidade (C)
function buscarInsumos() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('INSUMOS');
  if(!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const insumos = [];
  
  for (let i = 1; i < data.length; i++) {
    if(data[i][0]) {
      insumos.push({
        cod: data[i][0].toString(),
        desc: data[i][1],
        un: data[i][2]
      });
    }
  }
  return insumos;
}

// Busca na aba EQUIPAMENTOS
// Espera-se: Nome/Frota na Coluna A
function buscarEquipamentos() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('EQUIPAMENTOS');
  if(!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const equip = [];
  
  for (let i = 1; i < data.length; i++) {
    if(data[i][0]) equip.push(data[i][0].toString());
  }
  return equip;
}
