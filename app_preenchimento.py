#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # Usar backend não interativo
import os
import io
import base64
import json
import uuid
from datetime import datetime
import tempfile
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size
app.config['SECRET_KEY'] = str(uuid.uuid4())

# Criar pasta de uploads se não existir
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Armazenar dados das planilhas em memória (sessão)
session_data = {}

# Lista de setores da empresa
SETORES = [
    "Comercial", "Engenharia de Produto", "Financeiro", "Compras", 
    "Gestão de Pessoas", "Produção Matriz", "Produção Filial", "PCP", 
    "Manutenção", "Engenharia Industrial", "Qualidade", "Direção"
]

# Exemplos de indicadores por setor
INDICADORES_POR_SETOR = {
    "Compras": ["Prazo de Entrega de MP", "Redução do Custo de MP", "Estoque de MP", "Cesta de Preços"],
    "Qualidade": ["Taxa de Defeitos", "Índice de Conformidade", "Reclamações de Clientes", "Custo da Não Qualidade"],
    "Produção Matriz": ["Eficiência Operacional", "Tempo de Setup", "Produtividade", "OEE"],
    "Produção Filial": ["Eficiência Operacional", "Tempo de Setup", "Produtividade", "OEE"],
    "Manutenção": ["Tempo Médio Entre Falhas", "Disponibilidade de Equipamentos", "Custo de Manutenção", "MTTR"],
    "Comercial": ["Volume de Vendas", "Novos Clientes", "Satisfação do Cliente", "Market Share"],
    "Financeiro": ["Margem de Lucro", "Fluxo de Caixa", "Retorno sobre Investimento", "EBITDA"],
    "PCP": ["Aderência ao Plano de Produção", "Lead Time", "Nível de Estoque", "Giro de Estoque"],
    "Engenharia de Produto": ["Tempo de Desenvolvimento", "Taxa de Inovação", "Custo de Desenvolvimento", "Projetos Concluídos"],
    "Gestão de Pessoas": ["Turnover", "Absenteísmo", "Horas de Treinamento", "Clima Organizacional"],
    "Engenharia Industrial": ["Eficiência de Processos", "Redução de Desperdícios", "Melhorias Implementadas", "Kaizen"],
    "Direção": ["Resultado Operacional", "Market Share", "Crescimento Anual", "ROI"]
}

def gerar_id_sessao():
    """Gera um ID único para a sessão"""
    return str(uuid.uuid4())

def carregar_planilha(file_path):
    """Carrega uma planilha Excel e retorna um dicionário com os dados de cada aba"""
    try:
        xls = pd.ExcelFile(file_path)
        dados_planilha = {}
        
        for sheet_name in xls.sheet_names:
            dados_planilha[sheet_name] = pd.read_excel(file_path, sheet_name=sheet_name)
        
        return dados_planilha
    except Exception as e:
        print(f"Erro ao carregar planilha {file_path}: {str(e)}")
        return None

def processar_dados(planilhas):
    """Processa os dados das planilhas para facilitar a visualização"""
    dados_processados = {}
    
    for nome_planilha, abas in planilhas.items():
        # Identificar o setor com base no nome da planilha
        setor_identificado = None
        for setor in SETORES:
            if setor.lower() in nome_planilha.lower():
                setor_identificado = setor
                break
        
        if not setor_identificado:
            # Se não conseguir identificar o setor pelo nome, usar "Outros"
            setor_identificado = "Outros"
        
        # Processar cada aba da planilha
        for nome_aba, df in abas.items():
            # Identificar o indicador com base no nome da aba
            indicador_identificado = nome_aba
            
            # Armazenar os dados processados
            if setor_identificado not in dados_processados:
                dados_processados[setor_identificado] = {}
            
            dados_processados[setor_identificado][indicador_identificado] = df
    
    return dados_processados

def criar_grafico(df, titulo, tipo_grafico='linha', mostrar_tendencia=False):
    """Cria um gráfico com os dados do DataFrame e retorna como imagem base64"""
    plt.figure(figsize=(10, 6))
    ax = plt.subplot(111)
    
    # Tentar identificar dados numéricos para o gráfico
    dados_numericos = df.select_dtypes(include=['number'])
    
    if not dados_numericos.empty:
        # Se tiver dados numéricos, criar gráficos conforme seleção
        if len(dados_numericos.columns) > 0:
            # Identificar possíveis colunas para o eixo x
            x_col = None
            
            # Priorizar colunas de data
            for col in df.columns:
                if 'data' in str(col).lower() or 'mes' in str(col).lower() or 'ano' in str(col).lower():
                    x_col = col
                    break
            
            # Se não encontrou coluna de data, usar a primeira coluna
            if x_col is None and len(df.columns) > 0:
                x_col = df.columns[0]
            
            # Criar gráfico conforme seleção
            if tipo_grafico == 'linha':
                # Gráfico de linha
                for col in dados_numericos.columns:
                    ax.plot(df[x_col] if x_col else range(len(df)), dados_numericos[col], 
                           marker='o', label=str(col))
                    
                    # Adicionar linha de tendência se selecionado
                    if mostrar_tendencia:
                        x = range(len(df))
                        y = dados_numericos[col].values
                        z = np.polyfit(x, y, 1)
                        p = np.poly1d(z)
                        ax.plot(x, p(x), "r--", alpha=0.5)
            
            elif tipo_grafico == 'barra':
                # Gráfico de barras
                if len(dados_numericos.columns) == 1:
                    # Uma única série
                    ax.bar(df[x_col] if x_col else range(len(df)), 
                          dados_numericos[dados_numericos.columns[0]])
                else:
                    # Múltiplas séries
                    x = range(len(df))
                    width = 0.8 / len(dados_numericos.columns)
                    for i, col in enumerate(dados_numericos.columns):
                        ax.bar([p + width*i for p in x], dados_numericos[col], 
                              width=width, label=str(col))
            
            elif tipo_grafico == 'pizza' and len(dados_numericos.columns) == 1:
                # Gráfico de pizza (apenas para uma série)
                ax.pie(dados_numericos[dados_numericos.columns[0]], 
                      labels=df[x_col] if x_col else None,
                      autopct='%1.1f%%', shadow=True, startangle=90)
                ax.axis('equal')  # Equal aspect ratio ensures that pie is drawn as a circle
            
            else:
                # Gráfico de linha (padrão)
                for col in dados_numericos.columns:
                    ax.plot(df[x_col] if x_col else range(len(df)), dados_numericos[col], 
                           marker='o', label=str(col))
            
            ax.set_title(titulo)
            ax.legend()
            ax.grid(True, linestyle='--', alpha=0.7)
            
            # Rotacionar labels do eixo x para melhor visualização
            plt.setp(ax.get_xticklabels(), rotation=45, ha='right')
            
            plt.tight_layout()
    else:
        # Se não tiver dados numéricos, exibir mensagem
        ax.text(0.5, 0.5, "Não foram encontrados dados numéricos para gerar o gráfico", 
               horizontalalignment='center', verticalalignment='center')
    
    # Salvar o gráfico em um buffer de memória
    buf = io.BytesIO()
    plt.savefig(buf, format='png')
    buf.seek(0)
    
    # Converter para base64 para exibir no HTML
    data = base64.b64encode(buf.getvalue()).decode('utf-8')
    plt.close()
    
    return f'data:image/png;base64,{data}'

def salvar_dados_planilha(file_path, sheet_name, df):
    """Salva os dados do DataFrame na planilha Excel"""
    try:
        # Verificar se o arquivo existe
        if os.path.exists(file_path):
            # Carregar todas as abas da planilha
            writer = pd.ExcelWriter(file_path, engine='openpyxl', mode='a', if_sheet_exists='replace')
            
            # Salvar o DataFrame na aba especificada
            df.to_excel(writer, sheet_name=sheet_name, index=False)
            
            # Fechar o writer para salvar as alterações
            writer.close()
            
            return True
        else:
            return False
    except Exception as e:
        print(f"Erro ao salvar dados na planilha {file_path}: {str(e)}")
        return False

@app.route('/')
def index():
    """Página inicial do dashboard"""
    # Gerar um ID de sessão se não existir
    session_id = request.cookies.get('session_id')
    if not session_id or session_id not in session_data:
        session_id = gerar_id_sessao()
        session_data[session_id] = {
            'planilhas': {},
            'dados_processados': {}
        }
    
    # Obter dados da sessão
    dados_sessao = session_data.get(session_id, {})
    planilhas = dados_sessao.get('planilhas', {})
    
    # Renderizar a página inicial
    rendered_template = render_template(
        'index.html',
        setores=SETORES,
        indicadores_por_setor=INDICADORES_POR_SETOR,
        planilhas_carregadas=list(planilhas.keys()),
        session_id=session_id
    )
    
    # Criar resposta a partir do template renderizado
    response = app.make_response(rendered_template)
    
    # Definir cookie de sessão
    if not request.cookies.get('session_id'):
        response.set_cookie('session_id', session_id)
    
    return response

@app.route('/upload', methods=['POST'])
def upload_file():
    """Endpoint para upload de planilhas"""
    session_id = request.cookies.get('session_id')
    if not session_id or session_id not in session_data:
        return redirect(url_for('index'))
    
    # Verificar se o arquivo foi enviado
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'Nenhum arquivo enviado'})
    
    file = request.files['file']
    
    # Verificar se o arquivo tem nome
    if file.filename == '':
        return jsonify({'success': False, 'error': 'Nenhum arquivo selecionado'})
    
    # Verificar se o arquivo é uma planilha Excel
    if file and file.filename.endswith(('.xlsx', '.xls')):
        # Salvar o arquivo temporariamente
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Carregar a planilha
        nome_arquivo = os.path.splitext(filename)[0]
        dados_planilha = carregar_planilha(file_path)
        
        if dados_planilha:
            # Armazenar os dados na sessão
            session_data[session_id]['planilhas'][nome_arquivo] = dados_planilha
            
            # Processar os dados
            session_data[session_id]['dados_processados'] = processar_dados(
                session_data[session_id]['planilhas']
            )
            
            return jsonify({
                'success': True, 
                'message': f'Arquivo {filename} carregado com sucesso',
                'planilhas_carregadas': list(session_data[session_id]['planilhas'].keys())
            })
        else:
            return jsonify({'success': False, 'error': f'Erro ao carregar o arquivo {filename}'})
    
    return jsonify({'success': False, 'error': 'Formato de arquivo não suportado'})

@app.route('/get_indicadores', methods=['GET'])
def get_indicadores():
    """Endpoint para obter indicadores de um setor"""
    session_id = request.cookies.get('session_id')
    if not session_id or session_id not in session_data:
        return jsonify({'success': False, 'error': 'Sessão inválida'})
    
    setor = request.args.get('setor')
    if not setor:
        return jsonify({'success': False, 'error': 'Setor não especificado'})
    
    # Obter indicadores do setor
    indicadores = INDICADORES_POR_SETOR.get(setor, [])
    
    # Adicionar indicadores encontrados nas planilhas
    dados_processados = session_data[session_id].get('dados_processados', {})
    if setor in dados_processados:
        for indicador in dados_processados[setor].keys():
            if indicador not in indicadores:
                indicadores.append(indicador)
    
    return jsonify({'success': True, 'indicadores': indicadores})

@app.route('/get_dados', methods=['GET'])
def get_dados():
    """Endpoint para obter dados de um indicador"""
    session_id = request.cookies.get('session_id')
    if not session_id or session_id not in session_data:
        return jsonify({'success': False, 'error': 'Sessão inválida'})
    
    setor = request.args.get('setor')
    indicador = request.args.get('indicador')
    tipo_grafico = request.args.get('tipo_grafico', 'linha')
    mostrar_tendencia = request.args.get('mostrar_tendencia', 'false').lower() == 'true'
    
    if not setor or not indicador:
        return jsonify({'success': False, 'error': 'Setor ou indicador não especificado'})
    
    # Buscar dados do indicador
    dados_encontrados = False
    df_indicador = None
    
    # Obter dados processados da sessão
    dados_processados = session_data[session_id].get('dados_processados', {})
    planilhas = session_data[session_id].get('planilhas', {})
    
    # Primeiro, verificar nos dados processados
    if setor in dados_processados:
        for nome_indicador, df in dados_processados[setor].items():
            if indicador.lower() in nome_indicador.lower():
                df_indicador = df
                dados_encontrados = True
                break
    
    # Se não encontrou nos dados processados, buscar nas planilhas originais
    if not dados_encontrados:
        for nome_planilha, abas in planilhas.items():
            # Verificar se o nome da planilha contém o setor
            if setor.lower() in nome_planilha.lower():
                for nome_aba, df in abas.items():
                    # Verificar se o nome da aba ou conteúdo contém o indicador
                    if (indicador.lower() in nome_aba.lower() or 
                        any(indicador.lower() in str(col).lower() for col in df.columns)):
                        
                        df_indicador = df
                        dados_encontrados = True
                        break
            
            if dados_encontrados:
                break
    
    if dados_encontrados and df_indicador is not None:
        # Converter DataFrame para HTML (tabela)
        tabela_html = df_indicador.to_html(classes='table table-striped table-bordered', index=False)
        
        # Criar gráfico
        grafico_base64 = criar_grafico(df_indicador, indicador, tipo_grafico, mostrar_tendencia)
        
        return jsonify({
            'success': True,
            'tabela_html': tabela_html,
            'grafico_base64': grafico_base64
        })
    else:
        return jsonify({
            'success': False,
            'error': f'Não foram encontrados dados para o indicador {indicador}'
        })

@app.route('/get_estrutura_indicador', methods=['GET'])
def get_estrutura_indicador():
    """Endpoint para obter a estrutura de um indicador para preenchimento"""
    session_id = request.cookies.get('session_id')
    if not session_id or session_id not in session_data:
        return jsonify({'success': False, 'error': 'Sessão inválida'})
    
    setor = request.args.get('setor')
    indicador = request.args.get('indicador')
    
    if not setor or not indicador:
        return jsonify({'success': False, 'error': 'Setor ou indicador não especificado'})
    
    # Buscar dados do indicador
    dados_encontrados = False
    df_indicador = None
    nome_planilha_encontrada = None
    nome_aba_encontrada = None
    
    # Obter dados processados da sessão
    dados_processados = session_data[session_id].get('dados_processados', {})
    planilhas = session_data[session_id].get('planilhas', {})
    
    # Primeiro, verificar nos dados processados
    if setor in dados_processados:
        for nome_indicador, df in dados_processados[setor].items():
            if indicador.lower() in nome_indicador.lower():
                df_indicador = df
                dados_encontrados = True
                
                # Encontrar o nome da planilha e da aba
                for nome_planilha, abas in planilhas.items():
                    if setor.lower() in nome_planilha.lower():
                        for nome_aba, df_aba in abas.items():
                            if nome_indicador.lower() == nome_aba.lower():
                                nome_planilha_encontrada = nome_planilha
                                nome_aba_encontrada = nome_aba
                                break
                
                break
    
    # Se não encontrou nos dados processados, buscar nas planilhas originais
    if not dados_encontrados:
        for nome_planilha, abas in planilhas.items():
            # Verificar se o nome da planilha contém o setor
            if setor.lower() in nome_planilha.lower():
                for nome_aba, df in abas.items():
                    # Verificar se o nome da aba ou conteúdo contém o indicador
                    if (indicador.lower() in nome_aba.lower() or 
                        any(indicador.lower() in str(col).lower() for col in df.columns)):
                        
                        df_indicador = df
                        dados_encontrados = True
                        nome_planilha_encontrada = nome_planilha
                        nome_aba_encontrada = nome_aba
                        break
            
            if dados_encontrados:
                break
    
    if dados_encontrados and df_indicador is not None:
        # Obter informações sobre as colunas
        colunas = []
        for col in df_indicador.columns:
            tipo = 'texto'
            if pd.api.types.is_numeric_dtype(df_indicador[col]):
                tipo = 'numero'
            elif pd.api.types.is_datetime64_any_dtype(df_indicador[col]):
                tipo = 'data'
            
            colunas.append({
                'nome': col,
                'tipo': tipo
            })
        
        return jsonify({
            'success': True,
            'colunas': colunas,
            'nome_planilha': nome_planilha_encontrada,
            'nome_aba': nome_aba_encontrada
        })
    else:
        return jsonify({
            'success': False,
            'error': f'Não foram encontrados dados para o indicador {indicador}'
        })

@app.route('/salvar_dados', methods=['POST'])
def salvar_dados():
    """Endpoint para salvar novos dados de um indicador"""
    session_id = request.cookies.get('session_id')
    if not session_id or session_id not in session_data:
        return jsonify({'success': False, 'error': 'Sessão inválida'})
    
    # Obter dados do formulário
    dados = request.json
    if not dados:
        return jsonify({'success': False, 'error': 'Nenhum dado recebido'})
    
    setor = dados.get('setor')
    indicador = dados.get('indicador')
    nome_planilha = dados.get('nome_planilha')
    nome_aba = dados.get('nome_aba')
    novos_dados = dados.get('dados')
    
    if not setor or not indicador or not nome_planilha or not nome_aba or not novos_dados:
        return jsonify({'success': False, 'error': 'Dados incompletos'})
    
    # Verificar se a planilha existe na sessão
    planilhas = session_data[session_id].get('planilhas', {})
    if nome_planilha not in planilhas or nome_aba not in planilhas[nome_planilha]:
        return jsonify({'success': False, 'error': 'Planilha ou aba não encontrada'})
    
    # Obter o DataFrame atual
    df_atual = planilhas[nome_planilha][nome_aba]
    
    # Converter novos dados para DataFrame
    df_novos = pd.DataFrame([novos_dados])
    
    # Verificar se as colunas são compatíveis
    for col in df_novos.columns:
        if col not in df_atual.columns:
            return jsonify({'success': False, 'error': f'Coluna {col} não encontrada no indicador'})
    
    # Adicionar novos dados ao DataFrame
    df_atualizado = pd.concat([df_atual, df_novos], ignore_index=True)
    
    # Atualizar o DataFrame na sessão
    planilhas[nome_planilha][nome_aba] = df_atualizado
    
    # Atualizar os dados processados
    session_data[session_id]['dados_processados'] = processar_dados(planilhas)
    
    # Salvar os dados na planilha original
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{nome_planilha}.xlsx")
    if os.path.exists(file_path):
        try:
            # Criar um ExcelWriter com o arquivo existente
            with pd.ExcelWriter(file_path, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
                # Salvar o DataFrame atualizado na aba
                df_atualizado.to_excel(writer, sheet_name=nome_aba, index=False)
            
            return jsonify({
                'success': True,
                'message': 'Dados salvos com sucesso'
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'Erro ao salvar dados na planilha: {str(e)}'
            })
    else:
        return jsonify({
            'success': False,
            'error': 'Arquivo da planilha não encontrado'
        })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
