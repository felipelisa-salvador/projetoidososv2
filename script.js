document.addEventListener('DOMContentLoaded', () => {
    // =======================================================================
    // 1. CONFIGURAÇÃO DO FIREBASE (PREENCHA COM SUAS CHAVES!)
    // =======================================================================
    const firebaseConfig = {
        // PREENCHA ESTES CAMPOS COM AS CHAVES QUE VOCÊ COPIOU DO SEU CONSOLE FIREBASE
        apiKey: "SUA_API_KEY_AQUI", 
        authDomain: "SEU_AUTH_DOMAIN_AQUI.firebaseapp.com",
        databaseURL: "https://fumpres-coracao-default-rtdb.firebaseio.com", // Mantenha este URL se for o seu
        projectId: "SEU_PROJECT_ID_AQUI",
        storageBucket: "SEU_STORAGE_BUCKET.appspot.com",
        messagingSenderId: "SEU_MESSAGING_SENDER_ID",
        appId: "SEU_APP_ID"
    };

    // Inicialização do Firebase
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    const IDOSOS_REF = database.ref('idosos');
    const DOADORES_REF = database.ref('doadores');
    const LIMITE_PRESENTES = 2;
    // =======================================================================

    // === VARIÁVEIS DO DOM (HTML) ===
    const idososList = document.getElementById('idosos-list');
    const form = document.getElementById('selectionForm');
    const feedbackMessage = document.getElementById('feedback-message');
    const loadingMessage = document.getElementById('loading-message');

    // === ELEMENTOS DO FORMULÁRIO ===
    const nomeDoador = document.getElementById('nome_doador');
    const cpfDoador = document.getElementById('cpf_doador');
    const emailDoador = document.getElementById('email_doador');
    const celularDoador = document.getElementById('celular_doador');
    
    // =======================================================================
    // 2. IMPLEMENTAÇÃO DE MÁSCARAS E REGRAS
    // =======================================================================

    // MÁSCARA 1: CPF (XXX.XXX.XXX-XX)
    // Requer que você tenha incluído a biblioteca IMask no index.html
    if (typeof IMask !== 'undefined') {
        IMask(cpfDoador, {
            mask: '000.000.000-00'
        });

        // MÁSCARA 2: CELULAR (XX) X XXXX-XXXX (Atende 8 ou 9 dígitos após o DDD)
        IMask(celularDoador, {
            mask: [
                { mask: '(00) 0000-0000' }, // Formato com 8 dígitos (menos comum)
                { mask: '(00) 90000-0000' } // Formato com 9 dígitos (padrão Brasil)
            ]
        });
    }

    // REGRA 1: NOME (MAIÚSCULAS, SEM ACENTO, APENAS LETRAS E ESPAÇOS)
    nomeDoador.addEventListener('input', (e) => {
        let value = e.target.value;
        
        // Remove acentos e caracteres especiais, converte para maiúsculas
        value = value.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase();
        
        // Remove caracteres que não são letras ou espaço
        value = value.replace(/[^A-Z\s]/g, ''); 
        
        e.target.value = value;
    });

    // REGRA 2: VALIDAÇÃO DE E-MAIL
    function isValidEmail(email) {
        // Regex simples para validação de formato básico
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    
    // =======================================================================
    // 3. FUNÇÃO PARA BUSCAR E MOSTRAR A LISTA (FIREBASE READ)
    // =======================================================================
    function loadIdosos() {
        loadingMessage.classList.remove('hidden');
        idososList.innerHTML = '';
        
        IDOSOS_REF.once('value', snapshot => {
            loadingMessage.classList.add('hidden');
            const idososData = snapshot.val();
            
            if (!idososData) {
                 idososList.innerHTML = '<p>Nenhum idoso encontrado no banco de dados Firebase.</p>';
                 return;
            }

            const idososArray = Object.keys(idososData).map(key => ({
                id: key, 
                ...idososData[key]
            }));

            if (idososArray.length === 0) {
                idososList.innerHTML = '<p>Nenhum idoso encontrado no banco de dados Firebase.</p>';
                return;
            }

            idososArray.forEach(idoso => {
                const currentCount = Number(idoso.count || 0); 
                const isLimitReached = currentCount >= LIMITE_PRESENTES;
                const remaining = LIMITE_PRESENTES - currentCount;
                
                let statusText = isLimitReached ? 
                    `(Limite atingido)` : 
                    `(${currentCount}/${LIMITE_PRESENTES} - Faltam ${remaining})`;

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
        }).catch(error => {
            loadingMessage.classList.add('hidden');
            console.error("Erro ao carregar dados do Firebase:", error);
            idososList.innerHTML = '<p style="color: red;">Erro de conexão com o Firebase. Verifique sua configuração e regras de segurança.</p>';
        });
    }
    
    // =======================================================================
    // 4. FUNÇÃO DE ENVIO DO FORMULÁRIO (FIREBASE WRITE COM TRANSAÇÃO)
    // =======================================================================
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // VALIDAÇÕES CRÍTICAS (APÓS A MÁSCARA)
        // O CPF deve ter 14 caracteres (000.000.000-00)
        if (cpfDoador.value.length < 14) {
            alert("Por favor, preencha o CPF completo.");
            return;
        }

        // O Celular deve ter 15 caracteres ((00) 90000-0000)
        if (celularDoador.value.length < 15) {
            alert("Por favor, preencha o Contato Telefônico completo.");
            return;
        }

        if (!isValidEmail(emailDoador.value)) {
            alert("Por favor, insira um e-mail válido.");
            return;
        }
        // FIM VALIDAÇÕES CRÍTICAS

        const selectedIdosos = Array.from(document.querySelectorAll('input[name="idoso_id"]:checked'))
            .map(checkbox => checkbox.value);

        if (selectedIdosos.length === 0) {
            alert("Por favor, selecione pelo menos um idoso para apadrinhar.");
            return;
        }

        const doadorData = {
            nome: nomeDoador.value,
            cpf: cpfDoador.value,
            email: emailDoador.value,
            celular: celularDoador.value,
            timestamp: new Date().toISOString()
        };

        feedbackMessage.textContent = 'Verificando limites e salvando...';
        feedbackMessage.className = 'message';
        feedbackMessage.style.backgroundColor = '#fff3cd'; 
        feedbackMessage.classList.remove('hidden');
        document.getElementById('submit-button').disabled = true;

        let successfulChoices = 0;
        let failedChoices = 0;
        const failedIds = [];

        const updatePromises = selectedIdosos.map(idosoId => {
            const idosoRef = IDOSOS_REF.child(idosoId);

            // Transação: Lê o valor, verifica o limite e, se puder, atualiza.
            return idosoRef.child('count').transaction(currentCount => {
                const count = currentCount || 0;
                
                if (count < LIMITE_PRESENTES) {
                    return count + 1; 
                } else {
                    return; // Aborta a transação
                }
            }).then(result => {
                if (result.committed) {
                    successfulChoices++;
                } else {
                    failedChoices++;
                    failedIds.push(idosoId);
                }
            });
        });

        try {
            await Promise.all(updatePromises);
            
            if (successfulChoices > 0) {
                // Salva o log do doador
                await DOADORES_REF.push({
                    ...doadorData,
                    idosos_apadrinhados: selectedIdosos.filter(id => !failedIds.includes(id))
                });

                feedbackMessage.textContent = `Sucesso! Você apadrinhou ${successfulChoices} idoso(s). Obrigado!`;
                if (failedChoices > 0) {
                    feedbackMessage.textContent += ` (${failedChoices} não puderam ser apadrinhados: limite atingido.)`;
                }
                feedbackMessage.style.backgroundColor = '#d4edda'; 
                
                form.reset();
                loadIdosos();
                
            } else {
                feedbackMessage.textContent = 'Nenhum idoso pôde ser apadrinhado. O limite de 2 presentes já foi atingido para todos os selecionados.';
                feedbackMessage.style.backgroundColor = '#f8d7da'; 
            }
        } catch (error) {
            feedbackMessage.textContent = `Erro de comunicação com o banco de dados.`;
            feedbackMessage.style.backgroundColor = '#f8d7da'; 
            console.error('Erro no Firebase:', error);
        } finally {
            document.getElementById('submit-button').disabled = false;
        }
    });

    // Inicia o carregamento da lista
    loadIdosos();
});