// Variáveis globais para configuração
let tabelaVigente = "";
let rates = {};
let processedWaterData = [];
let processedGasData = [];
let averageValuePerM3Gas = 0;

// Função para carregar e validar o arquivo config.json
document.getElementById('file-input-config').addEventListener('change', handleFileConfig, false);

function handleFileConfig(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const configData = JSON.parse(event.target.result);
      if (validateConfigData(configData)) {
        tabelaVigente = configData.tabelaVigente;
        rates = configData.rates;
        document.getElementById('config-status').innerHTML = '<p class="text-success">Configuração carregada com sucesso!</p>';
        enableFileInputs();
        verificaAtualizacaoTabela(); // Chama a função para verificar a tabela após carregar a configuração
      } else {
        throw new Error('Configuração inválida.');
      }
    } catch (error) {
      document.getElementById('config-status').innerHTML = `<p class="text-danger">Erro ao carregar configuração: ${error.message}</p>`;
    }
  };
  reader.readAsText(file);
}

// Função para validar os dados do config.json
function validateConfigData(data) {
  const requiredRatesKeys = ['0-10', '10-20', '20-50', '50-1000'];
  if (typeof data.tabelaVigente !== 'string' || !data.tabelaVigente.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    return false;
  }
  if (typeof data.rates !== 'object') {
    return false;
  }
  for (const key of requiredRatesKeys) {
    if (typeof data.rates[key] !== 'number') {
      return false;
    }
  }
  return true;
}

// Função para habilitar os inputs de água e gás
function enableFileInputs() {
  document.getElementById('file-input-water').disabled = false;
  document.getElementById('file-input-gas').disabled = false;
}

// Função para verificar se a tabela precisa ser atualizada
function verificaAtualizacaoTabela() {
  if (!tabelaVigente) {
    // Se tabelaVigente não estiver definida, não faz nada
    return;
  }

  const hoje = new Date();
  const [dia, mes, ano] = tabelaVigente.split('/').map(Number);

  // Cria uma data com o dia e mês da tabela vigente, mas com o ano seguinte
  const dataProximaAtualizacao = new Date(ano + 1, mes - 1, dia - 10);

  // Verifica se a data atual é maior que a data de próxima atualização
  if (hoje > dataProximaAtualizacao) {
    document.getElementById('mensagem-tabela').textContent = '❗️Verifique e atualize a tabela SABESP!❗️';
    document.getElementById('mensagem-tabela1').textContent = '🗓Última Atualização: ' + tabelaVigente;
  } else {
    document.getElementById('mensagem-tabela').textContent = '✅A tabela SABESP está atualizada.✅';
    document.getElementById('mensagem-tabela1').textContent = '🗓Atualizada em: ' + tabelaVigente;
  }
}

// Chama a função para verificar a atualização da tabela quando a página é carregada
window.onload = verificaAtualizacaoTabela;

// Função para lidar com o upload de arquivos de água
document.getElementById('file-input-water').addEventListener('change', handleFileWater, false);
function handleFileWater(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = function(event) {
    const data = new Uint8Array(event.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    processWaterData(jsonData);
  };
  reader.readAsArrayBuffer(file);
}

// Função para lidar com o upload de arquivos de gás
document.getElementById('file-input-gas').addEventListener('change', handleFileGas, false);
function handleFileGas(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = function(event) {
    const data = new Uint8Array(event.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    processGasData(jsonData);
  };
  reader.readAsArrayBuffer(file);
}

// Processamento de dados de água
function processWaterData(data) {
  let sabespData = '';
  let historicalData = '';
  let totalValue = 0;
  let totalM3 = 0;
  let blocoData = {};
  let unidadeData = {};
  processedWaterData = []; // Limpar dados processados anteriores

  let quantidadeApartamentosAgua = validarQuantidadeApartamentosAgua(data);

  function validarQuantidadeApartamentosAgua(data) {
    let quantidadeApartamentos = 0;
    data.forEach(row => {
      if (row[0] && row[0].startsWith('APT')) {
        quantidadeApartamentos++;
      }
    });
    return quantidadeApartamentos;
  }

  let referenceMonthWater = data[7][1]; // Extrair o mês de referência da célula B8 (linha 7, coluna 1)
  let latestMonthWater = data[8][13]; // Extrair o mês mais recente da célula N9 (linha 8, coluna 13)
  let apartamentosPorBlocoAgua = {}; // Dados da SABESP (Linhas 7 a 14)

  const sabespRows = data.slice(7, 14);
  sabespRows.forEach((row, index) => {
    if (index === 3) {
      totalValue = parseFloat(row[1]);
    }
    if (index === 4) {
      totalM3 = parseFloat(row[1]);
    }
    sabespData += `<p>${row[0]} ${row[1]}</p>`;
  });

  const mediaPorUnidade = (totalM3 / numUnidades).toFixed(4);
  sabespData += `<p>📌<b>Média por unidade Calculada:</b> ${mediaPorUnidade} m³</p>`;
  sabespData += `<p>📌<b>Quantidade de apartamentos:</b> ${quantidadeApartamentosAgua}</p>`;

  // Dados de consumo histórico (Colunas N e O, linhas 8 a 13)
  const historicalRows = data.slice(8, 14);
  historicalRows.forEach(row => {
    historicalData += `<tr><td>${row[13]}</td><td>${row[14]}</td></tr>`;
  });

  const averageValuePerM3 = (totalValue / totalM3).toFixed(6);
  sabespData += `<p class="highlight">💲Custo Médio: R$${averageValuePerM3} m³</p>`;

  const latestConsumption = parseFloat(data[8][14]); // Consumo mais recente (linha 9, coluna O)
  const comparisonResult = ((totalM3 / latestConsumption) * 100).toFixed(2);
  const comparisonColor = comparisonResult < 100 ? 'green' : 'red';

  document.getElementById('water-data').innerHTML = `
    <div class="card">
      <div class="card-header"><b>💧Dados da Sabesp</b></div>
      <div class="card-body">${sabespData}</div><br><br>
    </div>
    <div class="card mt-4">
      <div class="card-header"><b>💧Consumo Histórico</b></div>
      <div class="card-body">
        <table class="table table-striped table table-sm">
          <thead><tr><th>Referência</th><th>Consumo (m³)</th></tr></thead>
          <tbody>${historicalData}</tbody>
        </table>
      </div>
    </div>
    <div class="card mt-4">
      <div class="card-header"><b>💧Comparação de Consumo </b></div>
      <div class="card-body">
        <p><b>Consumo do Mês de Referência (${referenceMonthWater}):</b> ${totalM3} m³</p>
        <p><b>Consumo do Mês Mais Recente (${latestMonthWater}):</b> ${latestConsumption} m³</p>
        <p style="color: ${comparisonColor};"><b>🎯Percentual: ${comparisonResult}%</b></p>
      </div>
    </div>
  `;
  document.getElementById('tabelasabesp').innerHTML = `
    <div class="card mt-4">
      <div class="card-header"><b>💧Faixas de Valores Sabesp - <small>(Tabela Vigente: ${tabelaVigente})</small></b></div>
      <div class="card-body">
        <p><span class="highlight">🕛Até 10 m³:</span> R$${rates['0-10']} fixo</p>
        <p><span class="highlight">🕛10 a 20 m³:</span> R$${rates['10-20']} m³</p>
        <p><span class="highlight">🕛20 a 50 m³:</span> R$${rates['20-50']} m³</p>
        <p><span class="highlight">🕛Até 1000 m³:</span> R$${rates['50-1000']} m³</p>
      </div>
    </div>
  `;

  // Função para calcular o custo com base no volume - Água
  function calculateCost(volume) {
    let cost = 0;
    if (volume <= 10) {
      cost = rates['0-10'];
    } else if (volume <= 20) {
      cost = rates['0-10'] + (volume - 10) * rates['10-20'];
    } else if (volume <= 50) {
      cost = rates['0-10'] + 10 * rates['10-20'] + (volume - 20) * rates['20-50'];
    } else {
      cost = rates['0-10'] + 10 * rates['10-20'] + 30 * rates['20-50'] + (volume - 50) * rates['50-1000'];
    }
    return cost.toFixed(2);
  }

  // Processar dados de consumo das unidades - Água
  let unitData = '';
  let headers = ['Apto', 'Bloco', 'Tipo', '🕒Anterior', '🕒Atual', '🕒Volume', '💲Consumido', '💲Total', 'Volume🧾', 'Custo🧾', '✅Volume', '✅Custo'];
  for (let i = 17; i < data.length; i++) {
    const row = data[i];
    if (row[0] && row[0].startsWith('APT')) {
      const apt = row[0].replace(/\s+/g, ''); // Remover espaços
      const bloco = apt.split('-')[1]; // Obter bloco
      if (!apartamentosPorBlocoAgua[bloco]) {
        apartamentosPorBlocoAgua[bloco] = 0; // Inicializa contagem
      }
      apartamentosPorBlocoAgua[bloco]++; // Incrementa contagem
      const leituraAnterior = parseFloat(row[2]);
      const leituraAtual = parseFloat(row[3]);
      const volume = parseFloat(row[6]);
      const valorConsumido = parseFloat(row[7]).toFixed(2);
      const valorTotal = parseFloat(row[10]).toFixed(2);
      const volumeCalculado = (leituraAtual - leituraAnterior).toFixed(2); // Arredondar a uma casa decimal
      const validacaoVolumeClass = parseFloat(volume.toFixed(2)) === parseFloat(volumeCalculado) ? 'correct' : 'incorrect';
      const custoCalculado = calculateCost(parseFloat(volumeCalculado));
      const validacaoCustoClass = parseFloat(custoCalculado) === parseFloat(valorTotal) ? 'correct' : 'incorrect';
      processedWaterData.push({
        apt, bloco, leituraAnterior, leituraAtual, volume, valorConsumido, valorTotal, volumeCalculado, custoCalculado, validacaoVolumeClass, validacaoCustoClass
      });
      if (!blocoData[bloco]) {
        blocoData[bloco] = {
          consumos: [],
          contas: [],
          apts: []
        };
      }

      blocoData[bloco].consumos.push(volumeCalculado);
      blocoData[bloco].contas.push(parseFloat(custoCalculado));
      blocoData[bloco].apts.push({ apt, volumeCalculado, custoCalculado, leituraAnterior, leituraAtual, volume, valorConsumido, valorTotal });

      if (!unidadeData[apt]) {
        unidadeData[apt] = [];
      }
      unidadeData[apt].push({
        bloco,
        tipo: row[1],
        leituraAnterior: row[2],
        leituraAtual: row[3],
        volume: row[6],
        valorConsumido: row[7],
        valorTotal: row[10],
        volumeCalculado,
        custoCalculado,
        validacaoVolumeClass,
        validacaoCustoClass
      });

      unitData += `<tr>
        <td>${apt}</td>
        <td>${bloco}</td>
        <td>${row[1]}</td>
        <td>${row[2]}</td>
        <td>${row[3]}</td>
        <td>${volume.toFixed(2)}</td>
        <td>${valorConsumido}</td>
        <td>${valorTotal}</td>
        <td class="highlight">${volumeCalculado}</td>
        <td class="highlight">${custoCalculado}</td>
        <td class="${validacaoVolumeClass}">${parseFloat(volume.toFixed(2)) === parseFloat(volumeCalculado) ? '✅' : '🟥'}</td>
        <td class="${validacaoCustoClass}">${parseFloat(custoCalculado) === parseFloat(valorTotal) ? '✅' : '🟥'}</td>
      </tr>`;
    }
  }
  document.getElementById('unit-consumption').innerHTML = `
    <div class="card mt-4">
      <div class="card-header"><b>💧Consumo SABESP - Validar Método de Cálculo Sabesp</b></div>
      <div class="card-body">
        <table class="table table-striped table table-sm table-hover">
          <thead class="thead-dark">
            <tr>
              ${headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${unitData}</tbody>
        </table>
      </div>
    </div>
  `;
  if (processedGasData.length > 0) {
    criarTabelaValidacao();
  }

  // Processar estatísticas por bloco
  let blocoStats = '';
  let totalConsumoCondominio = 0;
  let totalCustoCondominio = 0;
  for (let bloco in blocoData) {
    const consumos = blocoData[bloco].consumos;
    const contas = blocoData[bloco].contas;
    const apts = blocoData[bloco].apts;
    const mediaConsumo = (consumos.reduce((acc, val) => acc + parseFloat(val), 0) / consumos.length).toFixed(2);
    const mediaConta = (contas.reduce((acc, val) => acc + parseFloat(val), 0) / contas.length).toFixed(2);
    const totalConsumo = consumos.reduce((acc, val) => acc + parseFloat(val), 0).toFixed(2);
    const totalArrecadacao = contas.reduce((acc, val) => acc + parseFloat(val), 0).toFixed(2);
    totalConsumoCondominio += parseFloat(totalConsumo);
    totalCustoCondominio += parseFloat(totalArrecadacao);
    const menoresConsumos = consumos.slice().sort((a, b) => a - b).slice(0, 5).map(consumo => {
      const aptInfo = apts.find(apt => apt.volumeCalculado === consumo);
      return `${consumo} (${aptInfo.apt})`;
    }).join(', ');
    const maioresConsumos = consumos.slice().sort((a, b) => b - a).slice(0, 5).map(consumo => {
      const aptInfo = apts.find(apt => apt.volumeCalculado === consumo);
      return `${consumo} (${aptInfo.apt})`;
    }).join(', ');
    blocoStats += `
      <div class="col-md-3">
        <div class="card">
          <div class="card-header"><b>💧Bloco ${bloco} </b></div>
          <div class="card-body">
            <p><span class="highlight">🟰Média de Consumo:</span><br> ${mediaConsumo} m³</p>
            <p><span class="highlight">💸Média de Conta:</span><br> R$ ${mediaConta}</p>
            <p><span class="highlight">🕒Consumo Total:</span><br> ${totalConsumo} m³</p>
            <p><span class="highlight">💰Arrecadação Total:</span><br> R$ ${totalArrecadacao}</p>
            <p><span class="highlight">🏢Apartamentos:</span><br> ${apartamentosPorBlocoAgua[bloco]}</p>
          </div>
        </div>
      </div>
    `;
  }
  // Estatísticas do condomínio
  const consumoEstimadoComum = (totalM3 - totalConsumoCondominio).toFixed(2);
  const valorEstimadoComum = (consumoEstimadoComum * averageValuePerM3).toFixed(2);
  totalCustoCondominio = totalCustoCondominio.toFixed(2);
  const PercentAreaComum = (consumoEstimadoComum / totalM3 * 100).toFixed(2);
  const Diferenca = (totalValue - valorEstimadoComum - totalCustoCondominio).toFixed(2);
  document.getElementById('bloco-stats').innerHTML = blocoStats;
  document.getElementById('condominio-card').innerHTML = `
    <div class="card">
      <div class="card-header"><h4><b>💧Indicadores do Condomínio</h4></b></div>
      <div class="card-body">
        <p><span class="highlight">🕓Consumo Total Calculado (Unidades):</span> ${totalConsumoCondominio} m³</p>
        <p><span class="highlight">🏠Consumo Estimado Área Comum:</span> ${consumoEstimadoComum} m³</p>
        <p><span class="highlight">🎯Part. Área Comum sobre Total Fatura(m³):</span> ${PercentAreaComum} %</p>
        <p><span class="highlight">💲Custo Total Calculado:</span> R$ ${totalCustoCondominio}</p>
        <p><span class="highlight">💲Valor Estimado Área Comum:</span> R$ ${valorEstimadoComum}</p>
        <p><span class="highlight">💲Custo Total Fatura:</span> R$ ${totalValue}</p>
        <p><span class="highlight" style="color:red">💲Diferença: R$ ${Diferenca} </span><br>(🟰Custo Fatura ➖ Unidades ➖ Area Comum)</p>
      </div>
    </div>
  `;
  // Gráfico comparativo dos blocos
  const chartContainer = document.getElementById('water-chart-container');
  chartContainer.innerHTML = `
    <h3 class="text-center mt-4">Consumo de Água por Bloco</h3>
      </div>
  `;
  const blocoLabels = Object.keys(blocoData);
  const consumoBlocos = blocoLabels.map(bloco => blocoData[bloco].consumos.reduce((acc, val) => acc + parseFloat(val), 0).toFixed(2));
  const maxConsumoBlocos = blocoLabels.map(bloco => Math.max(...blocoData[bloco].consumos).toFixed(2));
  const ctx = document.getElementById('bloco-chart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: blocoLabels,
      datasets: [
        {
          label: 'Consumo Total por Bloco (m³)',
          data: consumoBlocos,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        },
        {
          label: 'Consumo Máximo por Bloco (m³)',
          data: maxConsumoBlocos,
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Consumo (m³)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Blocos'
          }
        }
      }
    }
  });
  // Adicionar tabelas de detalhes para menores e maiores consumos
  let minMaxUnitTables = '';
  blocoLabels.forEach(bloco => {
    const menoresConsumos = blocoData[bloco].consumos.slice().sort((a, b) => a - b).slice(0, 10);
    const maioresConsumos = blocoData[bloco].consumos.slice().sort((a, b) => b - a).slice(0, 10);

    const menoresAptos = menoresConsumos.map(consumo => blocoData[bloco].apts.find(apt => apt.volumeCalculado == consumo));
    const maioresAptos = maioresConsumos.map(consumo => blocoData[bloco].apts.find(apt => apt.volumeCalculado == consumo));

    minMaxUnitTables += `
      <div class="col-12 mt-4">
        <h4>💧Detalhes dos Menores Consumos - Bloco ${bloco}</h4>
        <table class="table table-striped table table-sm">
         <thead class="thead-dark">
            <tr>
              ${headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${menoresAptos.map(apt => `
              <tr>
                <td><b>${apt.apt}</b></td>
                <td>${bloco}</td>
                <td>AF</td>
                <td>${apt.leituraAnterior}</td>
                <td>${apt.leituraAtual}</td>
                <td>${parseFloat(apt.volume).toFixed(2)}</td>
                <td>${parseFloat(apt.valorConsumido).toFixed(2)}</td>
                <td>${parseFloat(apt.valorTotal).toFixed(2)}</td>
                <td class="highlight">${apt.volumeCalculado}</td>
                <td class="highlight">${apt.custoCalculado}</td>
                <td class="${apt.validacaoVolumeClass}">${parseFloat(apt.volume).toFixed(2) == apt.volumeCalculado ? '✅' : '🟥'}</td>
                <td class="${apt.validacaoCustoClass}">${parseFloat(apt.custoCalculado) == parseFloat(apt.valorTotal) ? '✅' : '🟥'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="col-12 mt-4">
        <h4>💧Detalhes dos Maiores Consumos - Bloco ${bloco}</h4>
        <table class="table table-striped table table-sm">
          <thead class="thead-dark">
            <tr>
              ${headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${maioresAptos.map(apt => `
              <tr>
                <td><b>${apt.apt}</b></td>
                <td>${bloco}</td>
                <td>AF</td>
                <td>${apt.leituraAnterior}</td>
                <td>${apt.leituraAtual}</td>
                <td>${parseFloat(apt.volume).toFixed(2)}</td>
                <td>${parseFloat(apt.valorConsumido).toFixed(2)}</td>
                <td>${parseFloat(apt.valorTotal).toFixed(2)}</td>
                <td class="highlight">${apt.volumeCalculado}</td>
                <td class="highlight">${apt.custoCalculado}</td>
                <td class="${apt.validacaoVolumeClass}">${parseFloat(apt.volume).toFixed(2) == apt.volumeCalculado ? '✅' : '🟥'}</td>
                <td class="${apt.validacaoCustoClass}">${parseFloat(apt.custoCalculado) == parseFloat(apt.valorTotal) ? '✅' : '🟥'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  });

  document.getElementById('min-max-units').innerHTML = minMaxUnitTables;
}

// Processamento de dados de Gás
let apartamentosPorBlocoGas = {};
function processGasData(data) {
  let comgasData = '';
  let historicalData = '';
  let totalValueGas = 0;
  let totalM3Gas = 0;
  processedGasData = []; // Limpar dados processados anteriores

  let quantidadeApartamentosGasObj = validarQuantidadeApartamentosGas(data);
  let quantidadeApartamentosGas = quantidadeApartamentosGasObj.apartamentos;
  let quantidadeLanchonetesGas = quantidadeApartamentosGasObj.lanchonete;
  let referenceMonthGas = data[7][1]; // Extrair o mês de referência da célula B8 (linha 7, coluna 1)
  let latestMonthGas = data[8][11]; // Extrair o mês mais recente da célula L9 (linha 8, coluna 11)

  function validarQuantidadeApartamentosGas(data) {
    let quantidadeApartamentos = 0;
    data.forEach(row => {
      if (row[0] && row[0].startsWith('APT')) {
        quantidadeApartamentos++;
      }
    });

    let apartamentos = quantidadeApartamentos; // Ajustar a contagem se for exatamente 185
    let lanchonete = 0;
    if (quantidadeApartamentos == 185) {
      apartamentos = 184;
      lanchonete = 1;
    }
    return { apartamentos, lanchonete };
  }

  const comgasRows = data.slice(7, 15); // Dados da Comgás (Linhas 8 a 15)
  comgasRows.forEach((row, index) => {
    if (index === 3) totalValueGas = parseFloat(row[1]); // Valor em R$
    if (index === 4) totalM3Gas = parseFloat(row[1]); // Valor em m³
    comgasData += `<p>${row[0]} ${row[1]}</p>`;
  });

  const mediaPorUnidadeGas = (totalM3Gas / numUnidadesGas).toFixed(4);
  comgasData += `<p><b>📌Quantidade de apartamentos:</b> ${quantidadeApartamentosGas}</p>`;
  comgasData += `<p><b>🍲Lanchonete:</b> ${quantidadeLanchonetesGas}</p>`;

  const historicalRowsGas = data.slice(8, 14); // Dados de consumo histórico (Colunas L e M, linhas 8 a 14)
  historicalRowsGas.forEach(row => {
    historicalData += `<tr><td>${row[11]}</td><td>${row[12]}</td></tr>`;
  });

  averageValuePerM3Gas = (totalValueGas / totalM3Gas).toFixed(6);
  comgasData += `<p class="highlight">💲Custo Médio(Fator/m³): R$ ${averageValuePerM3Gas}</p>`;

  const latestConsumptionGas = parseFloat(data[8][12]); // Consumo mais recente (linha 9, coluna M)
  const comparisonResultGas = ((totalM3Gas / latestConsumptionGas) * 100).toFixed(2);
  const comparisonColorGas = comparisonResultGas < 100 ? 'green' : 'red';
  document.getElementById('gas-data').innerHTML = `
    <div class="card">
      <div class="card-header"><b>⛽Dados da Comgás</b></div>
      <div class="card-body">${comgasData}</div>
    </div>
    <div class="card mt-4">
      <div class="card-header"><b>⛽Consumo Histórico</b></div>
      <div class="card-body">
        <table class="table table-striped table table-sm">
          <thead><tr><th>Referencia</th><th>Consumo (m³)</th></tr></thead>
          <tbody>${historicalData}</tbody>
        </table>
      </div>
    </div>
    <div class="card mt-4">
      <div class="card-header"><b>⛽Comparação de Consumo</b></div>
      <div class="card-body" >
        <p><b>Consumo do Mês de Referência (${referenceMonthGas}):</b> ${totalM3Gas} m³</p>
        <p><b>Consumo do Mês Mais Recente (${latestMonthGas}):</b> ${latestConsumptionGas} m³</p>
        <p style="color: ${comparisonColorGas};"><b>🎯Percentual: ${comparisonResultGas}%</b></p>
      </div>
    </div>
  `;

  // Função para calcular o custo com base no volume - Gás
  function calculateCostGas(volume) {
    return (volume * averageValuePerM3Gas).toFixed(2);
  }

  // Processar dados de consumo das unidades - Gás
  let unitDataGas = '';
  for (let i = 17; i < data.length; i++) {
    const row = data[i];
    if (row[0] && row[0].startsWith('APT')) {
      const apt = row[0].replace(/\s+/g, ''); // Remover espaços
      const bloco = apt.split('-')[1]; // Obter bloco
      if (!apartamentosPorBlocoGas[bloco]) {
        apartamentosPorBlocoGas[bloco] = 0; // Inicializa contagem
      }
      apartamentosPorBlocoGas[bloco]++; // Incrementa contagem
      const leituraAnterior = parseFloat(row[2]);
      const leituraAtual = parseFloat(row[3]);
      const volume = parseFloat(row[6]);
      const valorConsumido = parseFloat(row[7]).toFixed(2);
      const valorTotal = parseFloat(row[10]).toFixed(2);
      const volumeCalculado = (leituraAtual - leituraAnterior).toFixed(2); // Arredondar a uma casa decimal
      const validacaoVolumeClass = parseFloat(volume.toFixed(2)) === parseFloat(volumeCalculado) ? 'correct' : 'incorrect';
      const custoCalculado = calculateCostGas(parseFloat(volumeCalculado));
      const validacaoCustoClass = parseFloat(custoCalculado) === parseFloat(valorTotal) ? 'correct' : 'incorrect';
      processedGasData.push({
        apt, bloco, leituraAnterior, leituraAtual, volume, valorConsumido, valorTotal, volumeCalculado, custoCalculado, validacaoVolumeClass, validacaoCustoClass
      });

      if (!blocoData[bloco]) {
        blocoData[bloco] = {
          consumos: [],
          contas: [],
          apts: []
        };
      }

      blocoData[bloco].consumos.push(volumeCalculado);
      blocoData[bloco].contas.push(parseFloat(custoCalculado));
      blocoData[bloco].apts.push({ apt, volumeCalculado, custoCalculado, leituraAnterior, leituraAtual, volume, valorConsumido, valorTotal });

      if (!unidadeData[apt]) {
        unidadeData[apt] = [];
      }
      unidadeData[apt].push({
        bloco,
        tipo: row[1],
        leituraAnterior: row[2],
        leituraAtual: row[3],
        volume: row[6],
        valorConsumido: row[7],
        valorTotal: row[10],
        volumeCalculado,
        custoCalculado,
        validacaoVolumeClass,
        validacaoCustoClass
      });

      unitDataGas += `<tr>
        <td>${apt}</td>
        <td>${bloco}</td>
        <td>${row[1]}</td>
        <td>${row[2]}</td>
        <td>${row[3]}</td>
        <td>${volume.toFixed(2)}</td>
        <td>${valorConsumido}</td>
        <td>${valorTotal}</td>
        <td class="highlight">${volumeCalculado}</td>
        <td class="highlight">${custoCalculado}</td>
        <td class="${validacaoVolumeClass}">${parseFloat(volume.toFixed(2)) === parseFloat(volumeCalculado) ? '✅' : '🟥'}</td>
        <td class="${validacaoCustoClass}">${parseFloat(custoCalculado) === parseFloat(valorTotal) ? '✅' : '🟥'}</td>
      </tr>`;
    }
  }

  document.getElementById('gas-unit-consumption').innerHTML = `
    <div class="card mt-4">
      <div class="card-header"><b>⛽Consumo COMGÁS - Validar Método de Cálculo COMGÁS</b></div>
      <div class="card-body">
        <table class="table table-striped table table-sm table-hover">
          <thead class="thead-dark">
            <tr>
              ${headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${unitDataGas}</tbody>
        </table>
      </div>
    </div>
  `;

  // Processar estatísticas por bloco - Gás
  let blocoStatsGas = '';
  let totalConsumoCondominioGas = 0;
  let totalCustoCondominioGas = 0;
  for (let bloco in blocoData) {
    const consumos = blocoData[bloco].consumos;
    const contas = blocoData[bloco].contas;
    const apts = blocoData[bloco].apts;
    const mediaConsumo = (consumos.reduce((acc, val) => acc + parseFloat(val), 0) / consumos.length).toFixed(2);
    const mediaConta = (contas.reduce((acc, val) => acc + parseFloat(val), 0) / contas.length).toFixed(2);
    const totalConsumo = consumos.reduce((acc, val) => acc + parseFloat(val), 0).toFixed(2);
    const totalArrecadacao = contas.reduce((acc, val) => acc + parseFloat(val), 0).toFixed(2);
    totalConsumoCondominioGas += parseFloat(totalConsumo);
    totalCustoCondominioGas += parseFloat(totalArrecadacao);
    const menoresConsumos = consumos.slice().sort((a, b) => a - b).slice(0, 5).map(consumo => {
      const aptInfo = apts.find(apt => apt.volumeCalculado === consumo);
      return `${consumo} (${aptInfo.apt})`;
    }).join(', ');
    const maioresConsumos = consumos.slice().sort((a, b) => b - a).slice(0, 5).map(consumo => {
      const aptInfo = apts.find(apt => apt.volumeCalculado === consumo);
      return `${consumo} (${aptInfo.apt})`;
    }).join(', ');
    blocoStatsGas += `
      <div class="col-md-3">
        <div class="card">
          <div class="card-header"><b>⛽Bloco ${bloco}</b></div>
          <div class="card-body">
            <p><span class="highlight">🟰Média de Consumo:</span><br> ${mediaConsumo} m³</p>
            <p><span class="highlight">💸Média de Conta:</span><br> R$ ${mediaConta}</p>
            <p><span class="highlight">🕒Consumo Total:</span><br> ${totalConsumo} m³</p>
            <p><span class="highlight">💰Arrecadação Total:</span><br> R$ ${totalArrecadacao}</p>
            <p><span class="highlight">🏢Apartamentos:</span><br> ${apartamentosPorBlocoGas[bloco]}</p>
          </div>
        </div>
      </div>
    `;
  }

  // Estatísticas do condomínio - Gás
  const consumoEstimadoComumGas = (totalM3Gas - totalConsumoCondominioGas).toFixed(2);
  const valorEstimadoComumGas = (consumoEstimadoComumGas * averageValuePerM3Gas).toFixed(2);
  totalCustoCondominioGas = totalCustoCondominioGas.toFixed(2);
  const PercentAreaComumGas = (consumoEstimadoComumGas / totalM3Gas * 100).toFixed(2);
  const DiferencaGas = (totalValueGas - valorEstimadoComumGas - totalCustoCondominioGas).toFixed(2);
  document.getElementById('gas-bloco-stats').innerHTML = blocoStatsGas;
  document.getElementById('condo-gas-summary').innerHTML = `
    <div class="card">
      <div class="card-header"><h4><b>⛽Indicadores do Condomínio</h4></b></div>
      <div class="card-body">
        <p><span class="highlight">🕓Consumo Total Calculado (Unidades):</span> ${totalConsumoCondominioGas} m³</p>
        <p><span class="highlight">🏠Consumo Estimado Área Comum:</span> ${consumoEstimadoComumGas} m³</p>
        <p><span class="highlight">🎯Part. Área Comum sobre Total Fatura(m³):</span> ${PercentAreaComumGas} %</p>
        <p><span class="highlight">💲Custo Total Calculado:</span> R$ ${totalCustoCondominioGas}</p>
        <p><span class="highlight">💲Valor Estimado Área Comum:</span> R$ ${valorEstimadoComumGas}</p>
        <p><span class="highlight">💲Custo Total Fatura:</span> R$ ${totalValueGas}</p>
        <p><span class="highlight" style="color:red">💲Diferença: R$ ${DiferencaGas} </span><br>(🟰Custo Fatura ➖ Unidades ➖ Area Comum)</p>
      </div>
    </div>
  `;

  // Gráfico comparativo dos blocos - Gás
  const chartContainerGas = document.getElementById('gas-chart-container');
  chartContainerGas.innerHTML = `
    <h3 class="text-center mt-4">Consumo de Gás por Bloco</h3>
  `;
  const blocoLabelsGas = Object.keys(blocoData);
  const consumoBlocosGas = blocoLabelsGas.map(bloco => blocoData[bloco].consumos.reduce((acc, val) => acc + parseFloat(val), 0).toFixed(2));
  const maxConsumoBlocosGas = blocoLabelsGas.map(bloco => Math.max(...blocoData[bloco].consumos).toFixed(2));
  const ctxGas = document.getElementById('gas-bloco-chart').getContext('2d');
  new Chart(ctxGas, {
    type: 'bar',
    data: {
      labels: blocoLabelsGas,
      datasets: [
        {
          label: 'Consumo Total por Bloco (m³)',
          data: consumoBlocosGas,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        },
        {
          label: 'Consumo Máximo por Bloco (m³)',
          data: maxConsumoBlocosGas,
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Consumo (m³)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Blocos'
          }
        }
      }
    }
  });
  // Adicionar tabelas de detalhes para menores e maiores consumos - Gás
  let minMaxUnitTablesGas = '';
  blocoLabelsGas.forEach(bloco => {
    const menoresConsumosGas = blocoData[bloco].consumos.slice().sort((a, b) => a - b).slice(0, 10);
    const maioresConsumosGas = blocoData[bloco].consumos.slice().sort((a, b) => b - a).slice(0, 10);

    const menoresAptosGas = menoresConsumosGas.map(consumo => blocoData[bloco].apts.find(apt => apt.volumeCalculado == consumo));
    const maioresAptosGas = maioresConsumosGas.map(consumo => blocoData[bloco].apts.find(apt => apt.volumeCalculado == consumo));

    minMaxUnitTablesGas += `
      <div class="col-12 mt-4">
        <h4>⛽Detalhes dos Menores Consumos - Bloco ${bloco}</h4>
        <table class="table table-striped table table-sm">
          <thead class="thead-dark">
            <tr>
              ${headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${menoresAptosGas.map(apt => `
              <tr>
                <td><b>${apt.apt}</b></td>
                <td>${bloco}</td>
                <td>AF</td>
                <td>${apt.leituraAnterior}</td>
                <td>${apt.leituraAtual}</td>
                <td>${parseFloat(apt.volume).toFixed(2)}</td>
                <td>${parseFloat(apt.valorConsumido).toFixed(2)}</td>
                <td>${parseFloat(apt.valorTotal).toFixed(2)}</td>
                <td class="highlight">${apt.volumeCalculado}</td>
                <td class="highlight">${apt.custoCalculado}</td>
                <td class="${apt.validacaoVolumeClass}">${parseFloat(apt.volume).toFixed(2) == apt.volumeCalculado ? '✅' : '🟥'}</td>
                <td class="${apt.validacaoCustoClass}">${parseFloat(apt.custoCalculado) == parseFloat(apt.valorTotal) ? '✅' : '🟥'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="col-12 mt-4">
        <h4>⛽Detalhes dos Maiores Consumos - Bloco ${bloco}</h4>
        <table class="table table-striped table table-sm">
          <thead class="thead-dark">
            <tr>
              ${headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${maioresAptosGas.map(apt => `
              <tr>
                <td><b>${apt.apt}</b></td>
                <td>${bloco}</td>
                <td>AF</td>
                <td>${apt.leituraAnterior}</td>
                <td>${apt.leituraAtual}</td>
                <td>${parseFloat(apt.volume).toFixed(2)}</td>
                <td>${parseFloat(apt.valorConsumido).toFixed(2)}</td>
                <td>${parseFloat(apt.valorTotal).toFixed(2)}</td>
                <td class="highlight">${apt.volumeCalculado}</td>
                <td class="highlight">${apt.custoCalculado}</td>
                <td class="${apt.validacaoVolumeClass}">${parseFloat(apt.volume).toFixed(2) == apt.volumeCalculado ? '✅' : '🟥'}</td>
                <td class="${apt.validacaoCustoClass}">${parseFloat(apt.custoCalculado) == parseFloat(apt.valorTotal) ? '✅' : '🟥'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  });

  document.getElementById('gas-min-max-units').innerHTML = minMaxUnitTablesGas;
}

// Função para criar a tabela de validação de consumo por unidade
function criarTabelaValidacao() {
  let tableContent = '<table class="table table-bordered"><thead><tr><th>Bloco</th><th>Apto</th><th>Volume (m³)</th><th>Custo (R$)</th><th>Validação Volume</th><th>Validação Custo</th></tr></thead><tbody>';

  processedWaterData.forEach((item) => {
    tableContent += `<tr>
      <td>${item.bloco}</td>
      <td>${item.apt}</td>
      <td>${item.volumeCalculado}</td>
      <td>${item.custoCalculado}</td>
      <td class="${item.validacaoVolumeClass}">${item.validacaoVolumeClass === 'correct' ? '✅' : '🟥'}</td>
      <td class="${item.validacaoCustoClass}">${item.validacaoCustoClass === 'correct' ? '✅' : '🟥'}</td>
    </tr>`;
  });

  processedGasData.forEach((item) => {
    tableContent += `<tr>
      <td>${item.bloco}</td>
      <td>${item.apt}</td>
      <td>${item.volumeCalculado}</td>
      <td>${item.custoCalculado}</td>
      <td class="${item.validacaoVolumeClass}">${item.validacaoVolumeClass === 'correct' ? '✅' : '🟥'}</td>
      <td class="${item.validacaoCustoClass}">${item.validacaoCustoClass === 'correct' ? '✅' : '🟥'}</td>
    </tr>`;
  });

  tableContent += '</tbody></table>';

  document.getElementById('unit-validation').innerHTML = `
    <div class="card mt-4">
      <div class="card-header"><b>Validação de Consumo por Unidade</b></div>
      <div class="card-body">
        ${tableContent}
      </div>
    </div>
  `;
}
