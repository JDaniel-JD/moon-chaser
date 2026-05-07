import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDoc, setDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
// Removido o import chato do firebase-storage!

// ⚠️ 1. COLOQUE SUAS CHAVES DO FIREBASE AQUI ⚠️
const firebaseConfig = {
  apiKey: "AIzaSyDkQaIFmZTXjtbreTONs3YZJdLaq6SRXFg",
  authDomain: "moon-chaser-de4a9.firebaseapp.com",
  projectId: "moon-chaser-de4a9",
  storageBucket: "moon-chaser-de4a9.firebasestorage.app",
  messagingSenderId: "905970074902",
  appId: "1:905970074902:web:a021ed6d8434d7b145fc37"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let competicaoAtiva = false;
let usuarioAtual = null;
let postagens = []; 

const statusDocRef = doc(db, "config", "competicao");

const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const adminPanel = document.getElementById('admin-panel');
const statusTexto = document.getElementById('status-competicao');
const btnIniciar = document.getElementById('btn-iniciar');
const feedCarros = document.getElementById('feed-carros');
const bottomBar = document.getElementById('bottom-bar');
const uiSeguidor = document.getElementById('ui-seguidor');
const uiAdmin = document.getElementById('ui-admin');

const fotoUploadSeguidor = document.getElementById('foto-upload');
const nomeArquivoSeguidor = document.getElementById('file-name-carro');
const fotoUploadAdmin = document.getElementById('admin-img-upload');
const nomeArquivoAdmin = document.getElementById('file-name-aviso');

const modalOverlay = document.getElementById('custom-modal');

// --- MONITOR DE SESSÃO ---

onAuthStateChanged(auth, (user) => {
    if (user) {
        // ⚠️ 2. COLOQUE SEU GMAIL PESSOAL AQUI ⚠️
        if (user.email === "seu.email.pessoal@gmail.com") {
            usuarioAtual = { role: 'admin', uid: user.uid, nome: user.displayName };
        } else {
            usuarioAtual = { role: 'participante', uid: user.uid, nome: user.displayName, ultimoVoto: 0 };
        }
        entrarNoApp();
    } else {
        usuarioAtual = null;
        logoutVisual();
    }
});

onSnapshot(statusDocRef, (docSnap) => {
    if (docSnap.exists()) {
        competicaoAtiva = docSnap.data().ativa;
        atualizarInterfaceCompeticao();
    } else {
        console.warn("Aviso: Crie a coleção 'config' e o documento 'competicao' no Firestore!");
    }
}, (error) => {
    console.error("Erro ao ler status:", error);
});

function atualizarInterfaceCompeticao() {
    if (competicaoAtiva) {
        statusTexto.textContent = "🔥 Competição Valendo!";
        statusTexto.className = "status ativa";
        if (btnIniciar) {
            btnIniciar.textContent = "Encerrar Competição";
            btnIniciar.style.backgroundColor = "#555";
        }
    } else {
        statusTexto.textContent = "Competição Fechada";
        statusTexto.className = "status inativa";
        if (btnIniciar) {
            btnIniciar.textContent = "Iniciar Competição";
            btnIniciar.style.backgroundColor = "#e50914";
        }
    }
    
    if (usuarioAtual && usuarioAtual.role === 'participante') {
        if (competicaoAtiva) {
            bottomBar.classList.remove('hidden');
            uiSeguidor.classList.remove('hidden');
        } else {
            bottomBar.classList.add('hidden');
            uiSeguidor.classList.add('hidden');
        }
    }
}

// --- FUNÇÕES DE BOTÕES (GLOBAL) ---

window.loginGoogle = async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        mostrarAlerta("Erro", "Falha no login com o Google: " + error.message);
    }
};

window.loginAdmin = () => {
    const user = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;

    if (user === 'admin' && pass === '1234') {
        usuarioAtual = { role: 'admin', nome: 'Administrador Master' };
        entrarNoApp();
    } else {
        mostrarAlerta("Acesso Negado", "Usuário ou senha incorretos.");
    }
};

window.logout = async () => {
    try {
        if (auth.currentUser) {
            await signOut(auth);
        } else {
            usuarioAtual = null;
            logoutVisual();
        }
    } catch (error) {
        mostrarAlerta("Erro", "Erro ao sair da conta.");
    }
};

window.toggleCompeticao = async () => {
    try {
        await updateDoc(statusDocRef, { ativa: !competicaoAtiva });
    } catch (error) {
        mostrarAlerta("Erro", "Crie o documento 'competicao' no Firebase Firestore!");
    }
};

window.postarAviso = async () => {
    const msg = document.getElementById('admin-msg').value;
    if (msg === "") return mostrarAlerta("Aviso Vazio", "Escreva a mensagem do anúncio.");

    mostrarAlerta("Postando...", "Enviando aviso para a galera...");

    try {
        let urlImagem = null;
        if (fotoUploadAdmin.files.length > 0) {
            urlImagem = await fazerUploadImagem(fotoUploadAdmin.files[0]);
        }

        await addDoc(collection(db, "postagens"), {
            tipo: 'aviso',
            texto: msg,
            foto: urlImagem,
            timestamp: Date.now()
        });

        fecharModal();
        document.getElementById('admin-msg').value = "";
        fotoUploadAdmin.value = "";
        nomeArquivoAdmin.textContent = "Imagem do aviso (opcional)";
        nomeArquivoAdmin.style.color = "#aaa";
        window.scrollTo(0, 0);
    } catch (error) {
        mostrarAlerta("Erro", "Falha ao postar: " + error.message);
    }
};

window.postarCarro = async () => {
    if (!competicaoAtiva) return mostrarAlerta("Atenção", "A competição está fechada!");
    
    const instaUser = document.getElementById('insta-user').value;
    if (instaUser === "" || fotoUploadSeguidor.files.length === 0) {
        return mostrarAlerta("Faltam Dados", "Preencha o seu @ e anexe a foto da nave!");
    }

    mostrarAlerta("Acelerando...", "Subindo a foto (Isso pode levar alguns segundos)...");

    try {
        // Envia para o ImgBB e pega a URL de volta
        const urlImagem = await fazerUploadImagem(fotoUploadSeguidor.files[0]);

        // Salva a URL e os dados no banco gratuito do Firebase
        await addDoc(collection(db, "postagens"), {
            tipo: 'carro',
            insta: instaUser,
            foto: urlImagem,
            likes: 0,
            timestamp: Date.now()
        });

        fecharModal();
        document.getElementById('insta-user').value = "";
        fotoUploadSeguidor.value = "";
        nomeArquivoSeguidor.textContent = "Nenhuma foto selecionada";
        nomeArquivoSeguidor.style.color = "#aaa";
        window.scrollTo(0, 0);
    } catch (error) {
        mostrarAlerta("Erro", "Falha ao enviar a foto: " + error.message);
    }
};

window.darLike = async (idPostagem, currentLikes) => {
    if (!competicaoAtiva) return mostrarAlerta("Atenção", "A competição já foi encerrada!");
    if (usuarioAtual.role === 'admin') return mostrarAlerta("Aviso", "O painel de Admin não vota!");

    mostrarAlerta("Processando...", "Validando o seu voto..."); // Feedback pro usuário não clicar duas vezes rápido

    try {
        // 1. Vai no banco de dados ver o histórico desse usuário específico
        const userRef = doc(db, "usuarios", usuarioAtual.uid);
        const userSnap = await getDoc(userRef);
        
        let ultimoVotoBD = 0;
        if (userSnap.exists()) {
            ultimoVotoBD = userSnap.data().ultimoVoto || 0;
        }

        // 2. Calcula a trava de 1 Hora
        const tempoAtual = Date.now();
        const umaHoraMs = 60 * 60 * 1000;
        const tempoPassado = tempoAtual - ultimoVotoBD;

        if (tempoPassado < umaHoraMs) {
            const minRestantes = Math.ceil((umaHoraMs - tempoPassado) / (60 * 1000));
            return mostrarAlerta("Calma piloto!", `Você já votou! Aguarde mais ${minRestantes} minuto(s) para votar novamente.`);
        }

        // 3. Tudo certo! Registra o like no carro...
        const postRef = doc(db, "postagens", idPostagem);
        await updateDoc(postRef, { likes: currentLikes + 1 });

        // 4. E carimba o horário do voto no perfil do usuário lá no Firebase! (Trava definitiva)
        await setDoc(userRef, { ultimoVoto: tempoAtual }, { merge: true });

        mostrarAlerta("Voto Registrado 🔥", "Seu voto fortaleceu o projeto!");
    } catch (error) {
        mostrarAlerta("Erro", "Falha ao registrar voto: " + error.message);
    }
};

window.excluirPost = (idPostagem) => {
    mostrarConfirmacao("Excluir Postagem", "Tem certeza que deseja apagar essa nave ou aviso definitivamente?", async () => {
        try {
            await deleteDoc(doc(db, "postagens", idPostagem));
        } catch (error) {
            mostrarAlerta("Erro", "Falha ao excluir: " + error.message);
        }
    });
};

// --- UPLOAD 100% GRATUITO VIA IMGBB ---
async function fazerUploadImagem(file) {
    // ⚠️ 3. COLOQUE SUA CHAVE DA API DO IMGBB AQUI ⚠️
    const imgbbKey = "31221ef64a96af4b481f21d0db95d808"; 
    
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
        method: "POST",
        body: formData
    });

    const data = await response.json();
    
    if(data.success) {
        return data.data.url; // Devolve o link bonitinho da imagem
    } else {
        throw new Error("O servidor de imagens recusou o arquivo.");
    }
}

// --- FUNÇÕES DE RENDERIZAÇÃO ---

function carregarFeedFirebase() {
    try {
        const q = query(collection(db, "postagens"), orderBy("timestamp", "desc"));
        onSnapshot(q, (snapshot) => {
            postagens = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            ordenarFeed();
            renderizarFeed();
        });
    } catch (error) {
        console.error("Erro ao carregar o feed: ", error);
    }
}

function entrarNoApp() {
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    statusTexto.classList.remove('hidden');
    
    if (usuarioAtual.role === 'admin') {
        adminPanel.classList.remove('hidden');
        bottomBar.classList.remove('hidden');
        uiAdmin.classList.remove('hidden');
        uiSeguidor.classList.add('hidden');
    } else {
        adminPanel.classList.add('hidden');
        uiAdmin.classList.add('hidden');
        atualizarInterfaceCompeticao();
    }
    carregarFeedFirebase();
}

function logoutVisual() {
    appScreen.classList.add('hidden');
    statusTexto.classList.add('hidden');
    bottomBar.classList.add('hidden');
    loginScreen.classList.remove('hidden');
}

fotoUploadSeguidor.addEventListener('change', (e) => atualizarNomeArquivo(e, nomeArquivoSeguidor, "Nenhuma foto selecionada"));
fotoUploadAdmin.addEventListener('change', (e) => atualizarNomeArquivo(e, nomeArquivoAdmin, "Imagem do aviso (opcional)"));

function atualizarNomeArquivo(event, elementoTexto, textoPadrao) {
    if (event.target.files.length > 0) {
        elementoTexto.textContent = "Foto: " + event.target.files[0].name;
        elementoTexto.style.color = "#4cff4c";
    } else {
        elementoTexto.textContent = textoPadrao;
        elementoTexto.style.color = "#aaa";
    }
}

function mostrarAlerta(tit, msg) {
    document.getElementById('modal-title').textContent = tit;
    document.getElementById('modal-message').textContent = msg;
    document.getElementById('btn-modal-cancel').classList.add('hidden');
    document.getElementById('btn-modal-ok').onclick = fecharModal;
    modalOverlay.classList.remove('hidden');
}

function mostrarConfirmacao(tit, msg, acaoConfirmar) {
    document.getElementById('modal-title').textContent = tit;
    document.getElementById('modal-message').textContent = msg;
    document.getElementById('btn-modal-cancel').classList.remove('hidden');
    document.getElementById('btn-modal-ok').onclick = () => { fecharModal(); acaoConfirmar(); };
    document.getElementById('btn-modal-cancel').onclick = fecharModal;
    modalOverlay.classList.remove('hidden');
}

function fecharModal() { modalOverlay.classList.add('hidden'); }

function ordenarFeed() {
    const avisos = postagens.filter(p => p.tipo === 'aviso');
    const carros = postagens.filter(p => p.tipo === 'carro').sort((a,b) => b.likes - a.likes);
    postagens = [...avisos, ...carros];
}

function renderizarFeed() {
    feedCarros.innerHTML = "";
    postagens.forEach(item => {
        const card = document.createElement('div');
        const ehAdmin = usuarioAtual && usuarioAtual.role === 'admin';
        const btnDel = ehAdmin ? `<button class="btn-excluir" onclick="excluirPost('${item.id}')">🗑️ Excluir</button>` : '';
        
        if (item.tipo === 'aviso') {
            card.className = 'card-aviso';
            card.innerHTML = `<h5>📢 Aviso Oficial</h5><p>${item.texto}</p>${item.foto ? `<img src="${item.foto}" style="width:100%; margin-top:10px; border-radius:5px;">` : ''}${btnDel}`;
        } else {
            card.className = 'card-carro';
            card.innerHTML = `<img src="${item.foto}" alt="Carro da Competição"><div class="card-info"><div><span class="insta-arroba">${item.insta}</span>${btnDel}</div><button class="btn-like" onclick="darLike('${item.id}', ${item.likes})">🔥 ${item.likes} Votos</button></div>`;
        }
        feedCarros.appendChild(card);
    });
}

window.limparFeed = () => {
    mostrarConfirmacao(
        "Zerar Competição?", 
        "Isso apagará permanentemente TODAS as fotos e avisos do feed. Deseja continuar?", 
        async () => {
            mostrarAlerta("Limpando...", "Removendo postagens do banco de dados...");
            
            try {
                const querySnapshot = await getDocs(collection(db, "postagens"));
                
                // Cria uma lista de promessas para deletar tudo em paralelo (mais rápido)
                const deletarPromessas = querySnapshot.docs.map(post => deleteDoc(doc(db, "postagens", post.id)));
                
                await Promise.all(deletarPromessas);
                
                fecharModal();
                mostrarAlerta("Feed Limpo ✨", "Tudo pronto para a próxima edição da Batalha!");
            } catch (error) {
                mostrarAlerta("Erro ao Limpar", "Não foi possível resetar o feed: " + error.message);
            }
        }
    );
};