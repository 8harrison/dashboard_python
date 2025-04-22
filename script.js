// Script para o Dashboard de Indicadores

// Variáveis globais
let loadingModal;
let futureModal;

// Inicialização quando o documento estiver pronto
$(document).ready(function() {
    // Inicializar modais
    loadingModal = new bootstrap.Modal(document.getElementById('loading-modal'));
    futureModal = new bootstrap.Modal(document.getElementById('future-modal'));
    
    // Carregar indicadores iniciais
    carregarIndicadores();
    
    // Event listeners
    $('#select-setor').change(carregarIndicadores);
    $('#btn-atualizar').click(atualizarDashboard);
    $('#upload-form').submit(uploadPlanilha);
    
    // Event listeners para funcionalidades futuras
    $('#nav-analise, #nav-preenchimento').click(function(e) {
        e.preventDefault();
        mostrarFuncionalidadeFutura();
    });
});

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
        alert('Por favor, selecione um setor e um indicador.');
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
        alert('Por favor, selecione um arquivo para upload.');
        return;
    }
    
    // Verificar se o arquivo é uma planilha Excel
    const file = fileInput.files[0];
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        alert('Por favor, selecione um arquivo Excel (.xlsx ou .xls).');
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
                alert(response.message);
            } else {
                // Exibir mensagem de erro
                alert(`Erro: ${response.error}`);
            }
        },
        error: function(xhr, status, error) {
            // Esconder modal de carregamento
            loadingModal.hide();
            
            // Exibir mensagem de erro
            alert(`Erro ao fazer upload do arquivo: ${error}`);
            console.error(error);
        }
    });
}

// Função para mostrar modal de funcionalidade futura
function mostrarFuncionalidadeFutura() {
    futureModal.show();
}
