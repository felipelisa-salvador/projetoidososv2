document.addEventListener('DOMContentLoaded', () => {
    const idososList = document.getElementById('idosos-list');
    const form = document.getElementById('selectionForm');
    const feedbackMessage = document.getElementById('feedback-message');
    const loadingMessage = document.getElementById('loading-message');

    // === URL REAL DE IMPLANTAÇÃO (Mantenha sua URL aqui) ===
    const GOOGLE_APP_SCRIPT_URL = //'https://script.google.com/macros/s/AKfycbzMmwFAIrqhge4RWw2-PEQUpM6fR8udTWskSHzis0Dyel6dXJ4vzkdkNx-hOORF3Ps/exec'; 
                                   'https://script.google.com/a/macros/salvador.ba.gov.br/s/AKfycbzpz4PQeg2r8gzK_dSHw5u_QkoF5VRMuX09TAPYzuoL3Luz15PlN7mICGPCQxYj5B5R/exec'; 
    const API_GET_IDOSOS_URL = GOOGLE_APP_SCRIPT_URL; 
    const API_POST_SELECAO_URL = GOOGLE_APP_SCRIPT_URL; 

    // --- 1. FUNÇÃO PARA BUSCAR E MOSTRAR A LISTA (USANDO JSONP/CALLBACK) ---
    function loadIdosos() {
        loadingMessage.classList.remove('hidden');
        idososList.innerHTML = '';
        
        // Define o nome da função global que receberá os dados
        const callbackFunctionName = 'handleIdososData';

        // Cria a função de callback no escopo global (window)
        window[callbackFunctionName] = function(idosos) {
            
            // Remove o script tag após o carregamento (limpeza)
            const scriptTag = document.getElementById('jsonp-script');
            if(scriptTag) scriptTag.remove(); 

            loadingMessage.classList.add('hidden');
            
            // Verifica a integridade dos dados
            if (!Array.isArray(idosos) || idosos.length === 0) {
                 idososList.innerHTML = '<p>Nenhum idoso encontrado. Verifique a aba "Idosos" na planilha.</p>';
                 return;
            }

            // Mapeia e exibe a lista
            idosos.forEach(idoso => {
                const currentCount = Number(idoso.count); 
                const isLimitReached = currentCount >= 2;
                const remaining = 2 - currentCount;
                
                let statusText = isLimitReached ? 
                    `(Limite atingido)` : 
                    `(${currentCount}/2 - Faltam ${remaining})`;

                const card = document.createElement('div');
                card.className = 'card';
                card.dataset.id = idoso.id;
                
                card.innerHTML = `
                    <input type="checkbox" id="check-${idoso.id}" name="idoso_id" value="${idoso.id}" ${isLimitReached ? 'disabled' : ''}>
                    <label for="check-${idoso.id}">
                        <span class="nome">${idoso.nome}</span>, <span class="idade">${idoso.idade} anos</span>, <span class="sexo">${idoso.sexo}</span>
                        <span class="status-count" style="color: ${isLimitReached ? 'red' : '#0056b3'}">${statusText}</span>
                    </label>
                `;

                if (isLimitReached) {
                    card.style.backgroundColor = '#fce4e4'; 
                }

                idososList.appendChild(card);
            });
        };

        // Injeta a tag <script> para disparar a requisição JSONP
        const script = document.createElement('script');
        script.id = 'jsonp-script';
        script.src = API_GET_IDOSOS_URL + '?callback=' + callbackFunctionName;
        
        // Trata erro de carregamento (timeout ou falha de rede)
        script.onerror = function() {
            loadingMessage.classList.add('hidden');
            idososList.innerHTML = '<p style="color: red;">Erro ao carregar a lista. Verifique se a implantação do Apps Script está correta.</p>';
        };
        
        document.head.appendChild(script);
    }
    
    // --- 2. FUNÇÃO DE ENVIO DO FORMULÁRIO (USANDO FETCH/POST) ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const selectedIdosos = Array.from(document.querySelectorAll('input[name="idoso_id"]:checked'))
            .map(checkbox => checkbox.value);

        if (selectedIdosos.length === 0) {
            alert("Por favor, selecione pelo menos um idoso para apadrinhar.");
            return;
        }

        const doadorData = {
            nome: document.getElementById('nome_doador').value,
            cpf: document.getElementById('cpf_doador').value,
            email: document.getElementById('email_doador').value,
            celular: document.getElementById('celular_doador').value
        };

        const payload = {
            idosos_escolhidos: selectedIdosos,
            doador: doadorData
        };

        feedbackMessage.textContent = 'Enviando e validando suas escolhas...';
        feedbackMessage.className = 'message';
        feedbackMessage.style.backgroundColor = '#fff3cd'; 
        feedbackMessage.classList.remove('hidden');
        document.getElementById('submit-button').disabled = true;

        try {
            // Chamada REAL para o Apps Script (função doPost)
            const response = await fetch(API_POST_SELECAO_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();

            if (result.success) {
                feedbackMessage.textContent = result.message || `Sucesso! Você apadrinhou ${result.count} idoso(s). Obrigado!`;
                feedbackMessage.style.backgroundColor = '#d4edda'; 
                
                form.reset();
                loadIdosos(); // Recarrega a lista
                
            } else {
                feedbackMessage.textContent = result.message || 'Erro ao processar sua seleção. Tente novamente.';
                feedbackMessage.style.backgroundColor = '#f8d7da'; 
            }
        } catch (error) {
            feedbackMessage.textContent = `Erro de conexão. Verifique sua URL ou a implantação do Apps Script.`;
            feedbackMessage.style.backgroundColor = '#f8d7da'; 
            console.error('Erro de envio:', error);
        } finally {
            document.getElementById('submit-button').disabled = false;
        }
    });

    // Carrega a lista ao iniciar
    loadIdosos();
});