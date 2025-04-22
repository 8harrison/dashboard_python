// Script para o Dashboard de Indicadores

// Variáveis globais
let loadingModal;
let successModal;
let errorModal;
let currentView = 'visualizacao'; // visualizacao, preenchimento, analise

// Dados para armazenar informações do indicador selecionado para preenchimento
let indicadorPreenchimento = {
    setor: null,
    indicador: null,
    nome_planilha: null,
    nome_aba: null,
    colunas: []
};

// Inicialização quando o documento estiver pronto
$(document).ready(function() {
    // Inicializar modais
    loadingModal = new bootstrap.Modal(document.getElementById('loading-modal'));
    successModal = new bootstrap.Modal(document.getElementById('success-modal'));
    errorModal = new bootstrap.Modal(document.getElementById('error-modal'));
    
    // Carregar indicadores iniciais
    carregarIndicadores();
    
    // Event listeners para visualização
    $('#select-setor').change(carregarIndicadores);
    $('#btn-atualizar').click(atualizarDashboard);
    $('#upload-form').submit(uploadPlanilha);
    
    // Event listeners para navegação entre abas
    $('#nav-visualizacao').click(function(e) {
        e.preventDefault();
        mudarVisao('visualizacao');
    });
    
    $('#nav-preenchimento').click(function(e) {
        e.preventDefault();
        mudarVisao('preenchimento');
        // Resetar o formulário de preenchimento
        $('#form-preenchimento').hide();
        $('#preenchimento-info').show();
    });
    
    $('#nav-analise').click(function(e) {
        e.preventDefault();
        mudarVisao('analise');
    });
    
    // Event listeners para preenchimento
    $('#select-setor, #select-indicador').change(function() {
        if (currentView === 'preenchimento') {
            carregarEstruturaIndicador();
        }
    });
    
    $('#form-preenchimento').submit(function(e) {
        e.preventDefault();
        salvarDadosIndicador();
    });
    
    $('#btn-cancelar-preenchimento').click(function() {
        $('#form-preenchimento').hide();
        $('#preenchimento-info').show();
    });
});

// Função para mudar entre as diferentes visões (abas)
function mudarVisao(visao) {
    // Esconder todas as visões
    $('#visualizacao-container, #preenchimento-container, #analise-container').hide();
    
    // Remover classe active de todos os links de navegação
    $('#nav-visualizacao, #nav-preenchimento, #nav-analise').removeClass('active');
    
    // Mostrar a visão selecionada
    $(`#${visao}-container`).show();
    $(`#nav-${visao}`).addClass('active');
    
    // Atualizar a visão atual
    currentView = visao;
    
    // Se for a visão de preenchimento, carregar a estrutura do indicador
    if (visao === 'preenchimento') {
        carregarEstruturaIndicador();
    }
}

// Função para carregar indicadores com base no setor selecionado
function carregarIndicadores() {
    const setor = $('#select-setor').val();
    
    // Limpar select de indicadores
    $('#select-indicador').empty();
    
    // Mostrar indicador de carregamento
    $('#select-indicador').append('<option value="">Carregando...</option>');
    
    // Fazer requisição AJAX para obter indicadores
    $.ajax({
        url: '/get_indicadores',
        type: 'GET',
        data: { setor: setor },
        success: function(response) {
            // Limpar select de indicadores
            $('#select-indicador').empty();
            
            if (response.success) {
                // Adicionar indicadores ao select
                if (response.indicadores.length > 0) {
                    response.indicadores.forEach(function(indicador) {
                        $('#select-indicador').append(`<option value="${indicador}">${indicador}</option>`);
                    });
                    
                    // Se estiver na visão de preenchimento, carregar estrutura do indicador
                    if (currentView === 'preenchimento') {
                        carregarEstruturaIndicador();
                    }
                } else {
                    $('#select-indicador').append('<option value="">Nenhum indicador disponível</option>');
                }
            } else {
                // Exibir mensagem de erro
                $('#select-indicador').append('<option value="">Erro ao carregar indicadores</option>');
                console.error(response.error);
            }
        },
        error: function(xhr, status, error) {
            // Exibir mensagem de erro
            $('#select-indicador').empty();
            $('#select-indicador').append('<option value="">Erro ao carregar indicadores</option>');
            console.error(error);
        }
    });
}

// Função para atualizar o dashboard
function atualizarDashboard() {
    const setor = $('#select-setor').val();
    const indicador = $('#select-indicador').val();
    const tipoGrafico = $('input[name="tipo-grafico"]:checked').val();
    const mostrarTendencia = $('#check-tendencia').is(':checked');
    
    // Verificar se setor e indicador foram selecionados
    if (!setor || !indicador) {
        mostrarErro('Por favor, selecione um setor e um indicador.');
        return;
    }
    
    // Mostrar modal de carregamento
    loadingModal.show();
    
    // Fazer requisição AJAX para obter dados
    $.ajax({
        url: '/get_dados',
        type: 'GET',
        data: { 
            setor: setor, 
            indicador: indicador,
            tipo_grafico: tipoGrafico,
            mostrar_tendencia: mostrarTendencia
        },
        success: function(response) {
            // Esconder modal de carregamento
            loadingModal.hide();
            
            if (response.success) {
                // Atualizar tabela
                $('#tabela-container').html(response.tabela_html);
                
                // Aplicar formatação condicional para valores numéricos
                aplicarFormatacaoCondicional();
                
                // Atualizar gráfico
                $('#grafico-container').html(`<img src="${response.grafico_base64}" alt="Gráfico de ${indicador}" class="img-fluid">`);
            } else {
                // Exibir mensagem de erro
                $('#tabela-container').html(`<div class="alert alert-danger">${response.error}</div>`);
                $('#grafico-container').html(`<div class="alert alert-danger">${response.error}</div>`);
            }
        },
        error: function(xhr, status, error) {
            // Esconder modal de carregamento
            loadingModal.hide();
            
            // Exibir mensagem de erro
            $('#tabela-container').html(`<div class="alert alert-danger">Erro ao carregar dados: ${error}</div>`);
            $('#grafico-container').html(`<div class="alert alert-danger">Erro ao carregar dados: ${error}</div>`);
            console.error(error);
        }
    });
}

// Função para aplicar formatação condicional na tabela
function aplicarFormatacaoCondicional() {
    // Selecionar todas as células da tabela
    $('#tabela-container table tbody tr td').each(function() {
        const valor = parseFloat($(this).text());
        
        // Verificar se o valor é um número
        if (!isNaN(valor)) {
            // Aplicar classe com base no valor
            if (valor > 0) {
                $(this).addClass('valor-positivo');
            } else if (valor < 0) {
                $(this).addClass('valor-negativo');
            }
        }
    });
}

// Função para upload de planilha
function uploadPlanilha(e) {
    e.preventDefault();
    
    // Verificar se um arquivo foi selecionado
    const fileInput = $('#file-input')[0];
    if (fileInput.files.length === 0) {
        mostrarErro('Por favor, selecione um arquivo para upload.');
        return;
    }
    
    // Verificar se o arquivo é uma planilha Excel
    const file = fileInput.files[0];
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        mostrarErro('Por favor, selecione um arquivo Excel (.xlsx ou .xls).');
        return;
    }
    
    // Mostrar modal de carregamento
    loadingModal.show();
    $('#loading-message').text('Enviando arquivo, por favor aguarde...');
    
    // Criar FormData para envio do arquivo
    const formData = new FormData();
    formData.append('file', file);
    
    // Fazer requisição AJAX para upload do arquivo
    $.ajax({
        url: '/upload',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            // Esconder modal de carregamento
            loadingModal.hide();
            
            if (response.success) {
                // Atualizar status de upload
                $('#planilhas-carregadas').text(
                    `${response.planilhas_carregadas.length} arquivo(s) carregado(s): ${response.planilhas_carregadas.join(', ')}`
                );
                
                // Limpar input de arquivo
                $('#file-input').val('');
                
                // Recarregar indicadores
                carregarIndicadores();
                
                // Exibir mensagem de sucesso
                mostrarSucesso(response.message);
            } else {
                // Exibir mensagem de erro
                mostrarErro(response.error);
            }
        },
        error: function(xhr, status, error) {
            // Esconder modal de carregamento
            loadingModal.hide();
            
            // Exibir mensagem de erro
            mostrarErro(`Erro ao fazer upload do arquivo: ${error}`);
            console.error(error);
        }
    });
}

// Função para carregar a estrutura do indicador para preenchimento
function carregarEstruturaIndicador() {
    const setor = $('#select-setor').val();
    const indicador = $('#select-indicador').val();
    
    // Verificar se setor e indicador foram selecionados
    if (!setor || !indicador) {
        $('#form-preenchimento').hide();
        $('#preenchimento-info').show();
        return;
    }
    
    // Mostrar modal de carregamento
    loadingModal.show();
    
    // Fazer requisição AJAX para obter estrutura do indicador
    $.ajax({
        url: '/get_estrutura_indicador',
        type: 'GET',
        data: { 
            setor: setor, 
            indicador: indicador
        },
        success: function(response) {
            // Esconder modal de carregamento
            loadingModal.hide();
            
            if (response.success) {
                // Armazenar informações do indicador
                indicadorPreenchimento = {
                    setor: setor,
                    indicador: indicador,
                    nome_planilha: response.nome_planilha,
                    nome_aba: response.nome_aba,
                    colunas: response.colunas
                };
                
                // Atualizar título do formulário
                $('#indicador-selecionado').text(`${setor} - ${indicador}`);
                
                // Criar campos dinâmicos para cada coluna
                criarCamposFormulario(response.colunas);
                
                // Mostrar formulário
                $('#preenchimento-info').hide();
                $('#form-preenchimento').show();
            } else {
                // Exibir mensagem de erro
                $('#preenchimento-info').html(`<div class="alert alert-danger">${response.error}</div>`);
                $('#preenchimento-info').show();
                $('#form-preenchimento').hide();
            }
        },
        error: function(xhr, status, error) {
            // Esconder modal de carregamento
            loadingModal.hide();
            
            // Exibir mensagem de erro
            $('#preenchimento-info').html(`<div class="alert alert-danger">Erro ao carregar estrutura do indicador: ${error}</div>`);
            $('#preenchimento-info').show();
            $('#form-preenchimento').hide();
            console.error(error);
        }
    });
}

// Função para criar campos do formulário com base nas colunas do indicador
function criarCamposFormulario(colunas) {
    // Limpar campos existentes
    $('#campos-dinamicos').empty();
    
    // Criar campos para cada coluna
    colunas.forEach(function(coluna) {
        let campo = '';
        
        // Criar campo com base no tipo de dados
        if (coluna.tipo === 'numero') {
            campo = `
                <div class="col-md-6 mb-3">
                    <label for="campo-${coluna.nome}" class="form-label">${coluna.nome}:</label>
                    <input type="number" class="form-control" id="campo-${coluna.nome}" name="${coluna.nome}" step="any" required>
                </div>
            `;
        } else if (coluna.tipo === 'data') {
            campo = `
                <div class="col-md-6 mb-3">
                    <label for="campo-${coluna.nome}" class="form-label">${coluna.nome}:</label>
                    <input type="date" class="form-control" id="campo-${coluna.nome}" name="${coluna.nome}" required>
                </div>
            `;
        } else {
            campo = `
                <div class="col-md-6 mb-3">
                    <label for="campo-${coluna.nome}" class="form-label">${coluna.nome}:</label>
                    <input type="text" class="form-control" id="campo-${coluna.nome}" name="${coluna.nome}" required>
                </div>
            `;
        }
        
        // Adicionar campo ao formulário
        $('#campos-dinamicos').append(campo);
    });
    
    // Organizar campos em linhas
    const campos = $('#campos-dinamicos > div');
    for (let i = 0; i < campos.length; i += 2) {
        campos.slice(i, i + 2).wrapAll('<div class="row"></div>');
    }
}

// Função para salvar dados do indicador
function salvarDadosIndicador() {
    // Verificar se há um indicador selecionado
    if (!indicadorPreenchimento.setor || !indicadorPreenchimento.indicador) {
        mostrarErro('Nenhum indicador selecionado para preenchimento.');
        return;
    }
    
    // Coletar dados do formulário
    const dados = {};
    indicadorPreenchimento.colunas.forEach(function(coluna) {
        const campo = $(`#campo-${coluna.nome}`);
        dados[coluna.nome] = campo.val();
        
        // Converter para número se for do tipo número
        if (coluna.tipo === 'numero') {
            dados[coluna.nome] = parseFloat(dados[coluna.nome]);
        }
    });
    
    // Mostrar modal de carregamento
    loadingModal.show();
    $('#loading-message').text('Salvando dados, por favor aguarde...');
    
    // Preparar dados para envio
    const dadosEnvio = {
        setor: indicadorPreenchimento.setor,
        indicador: indicadorPreenchimento.indicador,
        nome_planilha: indicadorPreenchimento.nome_planilha,
        nome_aba: indicadorPreenchimento.nome_aba,
        dados: dados
    };
    
    // Fazer requisição AJAX para salvar dados
    $.ajax({
        url: '/salvar_dados',
        type: 'POST',
        data: JSON.stringify(dadosEnvio),
        contentType: 'application/json',
        success: function(response) {
            // Esconder modal de carregamento
            loadingModal.hide();
            
            if (response.success) {
                // Limpar formulário
                $('#form-preenchimento')[0].reset();
                
                // Exibir mensagem de sucesso
                mostrarSucesso('Dados salvos com sucesso!');
                
                // Esconder formulário
                $('#form-preenchimento').hide();
                $('#preenchimento-info').show();
                
                // Recarregar indicadores
                carregarIndicadores();
            } else {
                // Exibir mensagem de erro
                mostrarErro(response.error);
            }
        },
        error: function(xhr, status, error) {
            // Esconder modal de carregamento
            loadingModal.hide();
            
            // Exibir mensagem de erro
            mostrarErro(`Erro ao salvar dados: ${error}`);
            console.error(error);
        }
    });
}

// Função para mostrar mensagem de sucesso
function mostrarSucesso(mensagem) {
    $('#success-message').text(mensagem);
    successModal.show();
}

// Função para mostrar mensagem de erro
function mostrarErro(mensagem) {
    $('#error-message').text(mensagem);
    errorModal.show();
}
