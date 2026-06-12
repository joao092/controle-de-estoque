const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const cors = require("cors");
require("dotenv").config(); // Simplificado para pegar o .env da raiz no Render

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: { rejectUnauthorized: false },
});

app.post("/api/cadastro", async (req, res) => {
	const { nome_completo, idade, email, topico, outroInteresse } = req.body;

	try {
		// 1. Insere ou atualiza o usuário (conforme seu SQL)
		
		const userRes = await pool.query(
			"INSERT INTO usuarios (nome_completo, idade, email) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET nome_completo = $1 RETURNING id_usuario",
			[nome_completo, idade, email],
		);

		const idUsuario = userRes.rows[0].id_usuario;

		// 2. Insere a dúvida na tabela correta (duvidas)
		const queryDuvida = await pool.query(
			"INSERT INTO duvidas (id_usuario, topicos, titulo, descricao) VALUES ($1, $2, $3, $4)",
			[
				idUsuario,
				topico,
				"Interesse Geral",
				outroInteresse || "Nenhum comentário"
			],
		);

		await pool.query(
			"INSERT INTO logs (acao, descricao) VALUES ($1, $2)",
			[
				"Cadastro de usuário ou dúvida.",
				"Cadastro de usuário ou dúvida realizado.",
			],
		);

		return res.status(201).json({
			mensagem: "Cadastro e dúvida registrados com sucesso!",
		});
	} catch (err) {
		console.error(err);
		return res
			.status(500)
			.json({ erro: "Erro ao salvar no banco de dados" });
	}
});

// Servir arquivos estáticos da pasta onde está o index.html
app.use(express.static(__dirname));

app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Porta dinâmica obrigatória para o Render
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
	console.log("Servidor online na porta " + PORT);
});
