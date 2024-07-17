
    // Variáveis globais para configuração
    const numUnidades = 184; 
    const numUnidadesGas = 185;
    let tabelaVigente = "";
    let rates = {};

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
    return;
  }
  const hoje = new Date();
  const [dia, mes, ano] = tabelaVigente.split('/').map(Number);
  const dataProximaAtualizacao = new Date(ano + 1, mes - 1, dia - 10);  // Cria uma data com o dia e mês da tabela vigente, mas com o ano seguinte

  // Verifica se a data atual é maior que a data de próxima atualização
  if (hoje > dataProximaAtualizacao) {
    document.getElementById('mensagem-tabela').textContent = '❗️Verifique e atualize a tabela SABESP!❗️';
    document.getElementById('mensagem-tabela1').textContent = '🗓Última Atualização: ' + tabelaVigente;
  } else {
    document.getElementById('mensagem-tabela').textContent = '✅A tabela SABESP está atualizada.✅';
    document.getElementById('mensagem-tabela1').textContent = '🗓Atualizada em: ' + tabelaVigente;
  }
}

// Função para formatar números com vírgula como separador decimal
  function formatNumberWithComma(num) {
    return num.toString().replace('.', ',');
  }
  function saveValidationTableAsExcel() {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['Apto', 'Bloco', 'Leitura Anterior Água', 'Leitura Atual Água', 'Volume Água Calculado', 'Valor Consumo Água', 'Leitura Anterior Gás', 'Leitura Atual Gás', 'Volume Gás Calculado', 'Valor Consumido Gás', 'Validação Volume Água', 'Validação Custo Água', 'Validação Volume Gás', 'Validação Custo Gás', 'Validação Fator Gás', 'Observação']
    ];
    const rows = document.querySelectorAll('#unit-validation table tbody tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      const rowData = [];
      cells.forEach(cell => {
        let cellText = cell.innerText; // Verifica se o valor da célula é um número
        // Converte o valor da célula para número e formata com vírgula
        if (!isNaN(cellText) && cellText.trim() !== '') {          
          cellText = formatNumberWithComma(parseFloat(cellText));
        }
        rowData.push(cellText);
      });
      wsData.push(rowData);
    });
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Validação Consumo');
    XLSX.writeFile(wb, 'validacao_consumo.xlsx');
}

  // Variáveis globais - Gás
  var averageValuePerM3Gas = 0;
  let processedWaterData = [];
  let processedGasData = [];
    document.getElementById('file-input-water').addEventListener('change', handleFileWater, false);
    document.getElementById('file-input-gas').addEventListener('change', handleFileGas, false);

    // Função para lidar com o upload de arquivos de água
    function handleFileWater(event) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = function(event) {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1});
        processWaterData(jsonData);
      };
      reader.readAsArrayBuffer(file);
    }

    // Função para lidar com o upload de arquivos de gás
    function handleFileGas(event) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = function(event) {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1});
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

  let referenceMonthWater = data[7][1];  // Extrair o mês de referência da célula B8 (linha 7, coluna 1)
  let latestMonthWater = data[8][13];   // Extrair o mês mais recente da célula N9 (linha 8, coluna 13)
  let apartamentosPorBlocoAgua = {};   // Dados da SABESP (Linhas 7 a 14)

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
                    <td class="${apt.validacaoVolumeClass}">${parseFloat(apt.volume).toFixed(2) == apt.volumeCalculado ? '✅' : 'I🟥'}</td>
                    <td class="${apt.validacaoCustoClass}">${parseFloat(apt.custoCalculado) == parseFloat(apt.valorTotal) ? '✅' : 'I🟥'}</td>
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
  let referenceMonthGas = data[7][1];  // Extrair o mês de referência da célula B8 (linha 7, coluna 1)
  let latestMonthGas = data[8][11];   // Extrair o mês mais recente da célula L9 (linha 8, coluna 11)

  function validarQuantidadeApartamentosGas(data) { 
    let quantidadeApartamentos = 0;
    data.forEach(row => {
      if (row[0] && row[0].startsWith('APT')) {
        quantidadeApartamentos++;
      }
    });

    let apartamentos = quantidadeApartamentos;     // Ajustar a contagem se for exatamente 185
    let lanchonete = 0;
    if (quantidadeApartamentos == 185) {
      apartamentos = 184;
      lanchonete = 1;
    }
    return { apartamentos, lanchonete };
  }

  const comgasRows = data.slice(7, 15);   // Dados da Comgás (Linhas 8 a 15)
  comgasRows.forEach((row, index) => {
    if (index === 3) totalValueGas = parseFloat(row[1]); // Valor em R$
    if (index === 4) totalM3Gas = parseFloat(row[1]); // Valor em m³
    comgasData += `<p>${row[0]} ${row[1]}</p>`;
  });

  const mediaPorUnidadeGas = (totalM3Gas / numUnidadesGas).toFixed(4);
  comgasData += `<p><b>📌Quantidade de apartamentos:</b> ${quantidadeApartamentosGas}</p>`;
  comgasData += `<p><b>🍲Lanchonete:</b> ${quantidadeLanchonetesGas}</p>`;

  const historicalRowsGas = data.slice(8, 14);   // Dados de consumo histórico (Colunas L e M, linhas 8 a 14)
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

  processGasUnits(data);
}

// Processar dados de consumo das unidades - Gás
function processGasUnits(data) {
  let unitDataGas = '';
  let headersGas = ['Apto', 'Bloco', '🕒Anterior', '🕒Atual', '🕒Volume', 'Volume🧾', '💲Consumido', '💲Total', '📍Conta Fator', 'Fator🧾', '✅Volume', '✅Custo', '✅Fator'];
  let statsByBlock = {};  // Estrutura para armazenar dados por bloco

  for (let i = 17; i < data.length; i++) {
    const row = data[i];
    if (row[0] && row[0].startsWith('APT')) {
      const apt = row[0].replace(/\s+/g, ''); // Remover espaços
      const bloco = apt.split('-')[1]; // Obter bloco
      if (!apartamentosPorBlocoGas[bloco]) {
        apartamentosPorBlocoGas[bloco] = 0; // Inicializa contagem
      }
      apartamentosPorBlocoGas[bloco]++; // Incrementa contagem
      const leituraAnterior = parseFloat(row[1]);
      const leituraAtual = parseFloat(row[2]);
      const volumeGas = parseFloat(row[4]);
      const volumeCalculado = (leituraAtual - leituraAnterior).toFixed(2); 
      const valorConsumido = parseFloat(row[5]).toFixed(6);
      const valorTotal = parseFloat(row[8]).toFixed(6);
      const fatorConta = (valorConsumido / volumeGas).toFixed(6);
      const fatorContaTTL = (valorTotal / volumeGas).toFixed(6);
      const fatorCalculado = parseFloat(averageValuePerM3Gas).toFixed(6);
      const validacaoVolumeClass = parseFloat(volumeCalculado) === parseFloat(volumeGas) ? 'correct' : 'incorrect'; 
      const validacaoCustoClass = parseFloat(valorConsumido) === parseFloat(valorTotal) ? 'correct' : 'incorrect';
      const validacaoFatorClass = parseFloat(fatorCalculado) === parseFloat(fatorConta) ? 'correct' : 'incorrect';
      const validacaoFatorTotalClass = parseFloat(fatorCalculado) === parseFloat(fatorContaTTL) ? 'correct' : 'incorrect';

      processedGasData.push({
        apt, bloco, leituraAnterior, leituraAtual, volumeGas, volumeCalculado, valorConsumido, valorTotal, fatorConta, fatorCalculado, validacaoVolumeClass, validacaoCustoClass, validacaoFatorClass
      });

      if (!statsByBlock[bloco]) {
        statsByBlock[bloco] = { totalGas: 0, consumptions: [] };
      }
      statsByBlock[bloco].totalGas += volumeGas;
      statsByBlock[bloco].consumptions.push({ volumeGas, apt, fatorConta, fatorContaTTL, leituraAnterior, leituraAtual, volumeCalculado, valorConsumido, valorTotal, validacaoVolumeClass, validacaoCustoClass, validacaoFatorClass });

      unitDataGas += `<tr>
        <td><b>${apt}</b></td>
        <td>${bloco}</td>
        <td>${leituraAnterior}</td>
        <td>${leituraAtual}</td>
        <td>${volumeGas}</td>
        <td>${volumeCalculado}</td>
        <td>${valorConsumido}</td>
        <td>${valorTotal}</td>
        <td><b>${fatorConta}</b></td>
        <td><b>${fatorCalculado}</b></td>
        <td class="${validacaoVolumeClass}">${validacaoVolumeClass === 'correct' ? '✅' : '🟥'}</td>
        <td class="${validacaoCustoClass}">${validacaoCustoClass === 'correct' ? '✅' : '🟥'}</td>
        <td class="${validacaoFatorClass}">${validacaoFatorClass === 'correct' ? '✅' : '🟥'}</td>
      </tr>`;
    }
  }

  document.getElementById('gas-unit-consumption').innerHTML = `
    <div class="card mt-4">
      <div class="card-header"><b>⛽Consumo Comgás - Validar Fator e Método de Cálculo </b></div>
      <div class="card-body">
        <table class="table table-striped table-hover">
          <thead class="thead-dark">
            <tr>${headersGas.map(header => `<th>${header}</th>`).join('')}</tr>
          </thead>
          <tbody>${unitDataGas}</tbody>
        </table>
      </div>
    </div>
  `;

  if (processedWaterData.length > 0) {
    criarTabelaValidacao();
  }

  calculateGasStats(statsByBlock, apartamentosPorBlocoGas);
  updateGasChart(statsByBlock);
  updateCondoIndicators(statsByBlock);

  // Adicionar tabelas de detalhes para menores e maiores consumos
  let minMaxUnitTables = '';
  Object.keys(statsByBlock).forEach(bloco => {
    const menoresConsumos = statsByBlock[bloco].consumptions.sort((a, b) => a.volumeGas - b.volumeGas).slice(0, 10);
    const maioresConsumos = statsByBlock[bloco].consumptions.sort((a, b) => b.volumeGas - a.volumeGas).slice(0, 10);

    minMaxUnitTables += `
      <div class="col-12 mt-4">
        <h4>⛽Detalhes dos Menores Consumos - Bloco ${bloco}</h4>
        <table class="table table-striped table table-sm">
          <thead class="thead-dark">
            <tr>
              <th>Apto</th>
              <th>Bloco</th>
              <th>🕒Anterior</th>
              <th>🕒Atual</th>
              <th>🕒Volume</th>
              <th>Volume🧾</th>
              <th>💲Consumido</th>
              <th>💲Total</th>
              <th>📍Conta Fator</th>
              <th>Fator🧾</th>
              <th>✅Volume</th>
              <th>✅Custo</th>
              <th>✅Fator</th>
            </tr>
          </thead>
          <tbody>
            ${menoresConsumos.map(consumo => `
              <tr>
                <td><b>${consumo.apt}</b></td>
                <td>${bloco}</td>
                <td>${consumo.leituraAnterior}</td>
                <td>${consumo.leituraAtual}</td>
                <td>${consumo.volumeGas.toFixed(2)}</td>
                <td>${consumo.volumeCalculado}</td>
                <td>${consumo.valorConsumido}</td>
                <td>${consumo.valorTotal}</td>
                <td><b>${consumo.fatorConta}</b></td>
                <td><b>${averageValuePerM3Gas}</b></td>
                <td>${consumo.validacaoVolumeClass === 'correct' ? '✅' : '🟥'}</td>
                <td>${consumo.validacaoCustoClass === 'correct' ? '✅' : '🟥'}</td>
                <td>${consumo.validacaoFatorClass === 'correct' ? '✅' : '🟥'}</td>
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
              <th>Apto</th>
              <th>Bloco</th>
              <th>🕒Anterior</th>
              <th>🕒Atual</th>
              <th>🕒Volume</th>
              <th>Volume🧾</th>
              <th>💲Consumido</th>
              <th>💲Total</th>
              <th>📍Conta Fator</th>
              <th>Fator🧾</th>
              <th>✅Volume</th>
              <th>✅Custo</th>
              <th>✅Fator</th>
            </tr>
          </thead>
          <tbody>
            ${maioresConsumos.map(consumo => `
              <tr>
                <td><b>${consumo.apt}</b></td>
                <td>${bloco}</td>
                <td>${consumo.leituraAnterior}</td>
                <td>${consumo.leituraAtual}</td>
                <td>${consumo.volumeGas.toFixed(2)}</td>
                <td>${consumo.volumeCalculado}</td>
                <td>${consumo.valorConsumido}</td>
                <td>${consumo.valorTotal}</td>
                <td><b>${consumo.fatorConta}</b></td>
                <td><b>${averageValuePerM3Gas}</b></td>
                <td>${consumo.validacaoVolumeClass === 'correct' ? '✅' : '🟥'}</td>
                <td>${consumo.validacaoCustoClass === 'correct' ? '✅' : '🟥'}</td>
                <td>${consumo.validacaoFatorClass === 'correct' ? '✅' : '🟥'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  });

  document.getElementById('gas-min-max-units').innerHTML = minMaxUnitTables;
}

function calculateGasStats(statsByBlock) {
  Object.keys(statsByBlock).forEach(block => {
    const blockData = statsByBlock[block];
    if (blockData.totalGas && blockData.consumptions.length > 0) {
      const averageGas = (blockData.totalGas / blockData.consumptions.length).toFixed(2);
      const minGas = Math.min(...blockData.consumptions.map(c => c.volumeGas)).toFixed(2);
      const maxGas = Math.max(...blockData.consumptions.map(c => c.volumeGas)).toFixed(2);

      const top5MinConsumos = blockData.consumptions.sort((a, b) => a.volumeGas - b.volumeGas).slice(0, 5);
      const top5MaxConsumos = blockData.consumptions.sort((a, b) => b.volumeGas - a.volumeGas).slice(0, 5);

      let lanchonete = blockData.consumptions.find(c => c.apt === 'APT0LANC-BB');
      let numApartamentos = apartamentosPorBlocoGas[block];
      let numLanchonetes = 0;
      
      if (lanchonete) {
        numApartamentos -= 1; // Subtrair a lanchonete da contagem de apartamentos
        numLanchonetes = 1;
      }

      document.getElementById('gas-bloco-stats').innerHTML += `
        <div class="col-md-3">
          <div class="card">
            <div class="card-header"><b>⛽Bloco ${block}</b></div>
            <div class="card-body">
              <p><span class="highlight">🟰Média de Consumo de Gás:</span><br> ${averageGas} m³</p>
              <p><span class="highlight">🕒Consumo Total:</span><br> ${blockData.totalGas.toFixed(2)} m³</p>
              <p><span class="highlight">🕒Consumo Mínimo:</span><br> ${minGas} m³</p>
              <p><span class="highlight">🕒Consumo Máximo:</span><br> ${maxGas} m³</p>
              <p><span class="highlight">🏢Apartamentos:</span><br> ${numApartamentos} ${numLanchonetes > 0 ? `(+${numLanchonetes} lanchonete )` : ''}</p>
            </div>
          </div>
        </div>
      `;
    }
  });
}

function updateGasChart(statsByBlock) {
  const chartContainer = document.getElementById('gas-chart-container');   // Adicionar cabeçalho antes do gráfico
  chartContainer.innerHTML = `
    <h3 class="text-center mt-4">Consumo de Gás por Bloco</h3>
    </div>
  `;

  const blocoLabels = Object.keys(statsByBlock);
  const consumoBlocos = blocoLabels.map(bloco => statsByBlock[bloco].totalGas.toFixed(2));
  const maxConsumoBlocos = blocoLabels.map(bloco => Math.max(...statsByBlock[bloco].consumptions.map(c => c.volumeGas)).toFixed(2));

  const ctx = document.getElementById('gas-bloco-chart').getContext('2d');
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
}

function updateCondoIndicators(statsByBlock) {
  let totalGas = 0;
  let totalConsumptionLanchonete = 0;
  let lanchoneteDetails = {};

  Object.keys(statsByBlock).forEach(bloco => {
    totalGas += statsByBlock[bloco].totalGas;

    // Verificar e adicionar consumo da lanchonete
    statsByBlock[bloco].consumptions.forEach(consumo => {
      if (consumo.apt === 'APT0LANC-BB') {
        totalConsumptionLanchonete += consumo.volumeGas;
        lanchoneteDetails = {
          leituraAnterior: consumo.leituraAnterior,
          leituraAtual: consumo.leituraAtual,
          volume: consumo.volumeGas,
          volumeCalculado: consumo.volumeCalculado,
          valorConsumido: consumo.valorConsumido,
        };
      }
    });
  });

  const consumptionWithoutLanchonete = totalGas - totalConsumptionLanchonete;

  document.getElementById('condo-gas-summary').innerHTML = `
    <div class="card">
      <div class="card-header"><b>⛽Indicadores do Condomínio</b></div>
      <div class="card-body">
        <p><b>🕓Total Consumo (m³):</b> ${totalGas.toFixed(2)}</p>
        <p><b>🕓🍲Consumo da Lanchonete (m³):</b> ${totalConsumptionLanchonete.toFixed(2)}</p>
        <p><b>🕓Consumo Sem Lanchonete (m³):</b> ${consumptionWithoutLanchonete.toFixed(2)}</p>
        <p><b>🍲Detalhes da Lanchonete:</b></p>
        <ul>
          <li class="no-bullet"><b>🕓Leitura Anterior:</b> ${lanchoneteDetails.leituraAnterior}</li>
          <li class="no-bullet"><b>🕓Leitura Atual:</b> ${lanchoneteDetails.leituraAtual}</li>
          <li class="no-bullet"><b>🕓Volume:</b> ${lanchoneteDetails.volume} m³</li>
          <li class="no-bullet"><b>🧾Volume Calculado:</b> ${lanchoneteDetails.volumeCalculado} m³</li>
          <li class="no-bullet"><b>💲Valor Consumido:</b>R$  ${parseFloat(lanchoneteDetails.valorConsumido).toFixed(2)}</li>

        </ul>
      </div>
    </div>
  `;
}

function criarTabelaValidacao() {
  const condicoesValidacao = {
    semConsumo: { agua: 0, gas: 0 },
    aguaAltaGasBaixo: { aguaMin: 10, gasMax: 5 },
    aguaEGasBaixo: { aguaMax: 5, gasMax: 5 },
    aguaEGasAlto: { aguaMin: 30, gasMin: 30 },
    aguaBaixoEGasBaixo: { aguaMax: 5, gasMax: 5 },
    aguaMuitoAltaGasModerado: { aguaMin: 30, gasMin: 5, gasMax: 20 },
    gasMuitoAltoAguaModerado: { gasMin: 30, aguaMin: 10, aguaMax: 30 },
    diferencaAlta: 30
  };

  let tabelaValidacao = '';
  let headers = ['Apto', 'Bloco', '🕒💧Anterior', '🕒💧Atual', '🧾💧Volume', '💲💧Consumo', '🕒⛽Anterior', '🕒⛽Atual', '🧾⛽Volume', '💲⛽Consumo', '✅💧Volume', '✅💧Custo', '✅⛽Volume', '✅⛽Custo', '✅⛽Fator', '📌Nota'];

  processedWaterData.forEach((agua) => {
    let gas = processedGasData.find(g => g.apt === agua.apt); // Encontrar o registro de gás correspondente pelo Apto
    let observacao = '';
    let observacaoClass = '';

    // Definindo condições de observação
    if (agua.volumeCalculado == condicoesValidacao.semConsumo.agua && gas && gas.volumeCalculado == condicoesValidacao.semConsumo.gas) {
      observacao = 'SEM Consumo - Acionar Unidade e ver número de moradores';
      observacaoClass = 'bg-warning';
    } else if (agua.volumeCalculado > condicoesValidacao.aguaAltaGasBaixo.aguaMin && gas && gas.volumeCalculado < condicoesValidacao.aguaAltaGasBaixo.gasMax) {
      observacao = 'Volume de água alto e gás baixo - Acionar Unidade e ver número de moradores';
      observacaoClass = 'bg-warning';
    } else if (agua.volumeCalculado < condicoesValidacao.aguaEGasBaixo.aguaMax && gas && gas.volumeCalculado < condicoesValidacao.aguaEGasBaixo.gasMax) {
      observacao = 'Baixo consumo de água e gás - Verificar se imóvel está vazio';
      observacaoClass = 'bg-warning';
    } else if (agua.volumeCalculado > condicoesValidacao.aguaEGasAlto.aguaMin || gas.volumeCalculado > condicoesValidacao.aguaEGasAlto.gasMin) {
      observacao = 'Consumo alto - Verificar uso e possível vazamento';
      observacaoClass = 'bg-danger';
    } else if (agua.volumeCalculado < condicoesValidacao.aguaBaixoEGasBaixo.aguaMax && gas.volumeCalculado < condicoesValidacao.aguaBaixoEGasBaixo.gasMax) {
      observacao = 'Consumo baixo - Verificar se imóvel está vazio';
      observacaoClass = 'bg-warning';
    } else if (agua.volumeCalculado > condicoesValidacao.aguaMuitoAltaGasModerado.aguaMin && gas.volumeCalculado > condicoesValidacao.aguaMuitoAltaGasModerado.gasMin && gas.volumeCalculado < condicoesValidacao.aguaMuitoAltaGasModerado.gasMax) {
      observacao = 'Volume de água muito alto e gás moderado - Verificar número de moradores';
      observacaoClass = 'bg-warning';
    } else if (gas.volumeCalculado > condicoesValidacao.gasMuitoAltoAguaModerado.gasMin && agua.volumeCalculado > condicoesValidacao.gasMuitoAltoAguaModerado.aguaMin && agua.volumeCalculado < condicoesValidacao.gasMuitoAltoAguaModerado.aguaMax) {
      observacao = 'Volume de gás muito alto e água moderado - Verificar número de moradores';
      observacaoClass = 'bg-warning';
    }

    if (gas) {
      tabelaValidacao += `<tr>
        <td><b>${agua.apt}<b></td>
        <td>${agua.bloco}</td>
        <td>${agua.leituraAnterior}</td>
        <td>${agua.leituraAtual}</td>
        <td><b>${agua.volumeCalculado}</b></td>
        <td>${agua.valorConsumido}</td>
        <td>${gas.leituraAnterior}</td>
        <td>${gas.leituraAtual}</td>
        <td><b>${gas.volumeCalculado}</b></td>
        <td>${gas.valorConsumido}</td>
        <td class="${agua.validacaoVolumeClass}">${agua.validacaoVolumeClass === 'correct' ? '✅' : '🟥'}</td>
        <td class="${agua.validacaoCustoClass}">${agua.validacaoCustoClass === 'correct' ? '✅' : '🟥'}</td>
        <td class="${gas.validacaoVolumeClass}">${gas.validacaoVolumeClass === 'correct' ? '✅' : '🟥'}</td>
        <td class="${gas.validacaoCustoClass}">${gas.validacaoCustoClass === 'correct' ? '✅' : '🟥'}</td>
        <td class="${gas.validacaoFatorClass}">${gas.validacaoFatorClass === 'correct' ? '✅' : '🟥'}</td>
        <td class="${observacaoClass}">${observacao}</td>
      </tr>`;
    }
  });

  document.getElementById('unit-validation').innerHTML = `
    <div class="card mt-4">
      <div class="card-header"><b><h3><center>Validação de Consumo por Unidade</h3></center></b><p style="text-align:right;"><center><button onclick="saveValidationTableAsExcel()">Salvar Tabela de Validação em Excel</button></center></p></div>
      <div class="card-body">
        <table class="table table-striped table-sm table-hover">
          <thead class="thead-dark">
            <tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>
          </thead>
          <tbody>${tabelaValidacao}</tbody>
        </table>
      </div>
    </div>
  `;
}
