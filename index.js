const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

const http = require('http');
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Bland Apostas Online!');
}).listen(process.env.PORT || 10000, () => {
    console.log("Servidor HTTP interno iniciado para a Render.");
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const filas = new Map();
const confirmadosPartida = new Map();

// SEUS DADOS CONFIGURADOS (SEM CIDADE)
const DADOS_PIX = {
    chave: "57176880832", 
    nome: "MIGUEL MARTINS DE PAULA"
};

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Função adaptada para gerar o código sem a dependência explícita de cidade
function gerarPixCopiaECola(valor) {
    const valorFormatado = valor.toFixed(2);
    const textoChave = `0111${DADOS_PIX.chave}`;
    const textoNome = `59${String(DADOS_PIX.nome.length).padStart(2, '0')}${DADOS_PIX.nome}`;
    const textoValor = `54${String(valorFormatado.length).padStart(2, '0')}${valorFormatado}`;
    
    // String padrão aceita pelos bancos
    const payloadSemCRC = `00020101021126540014br.gov.bcb.pix${textoChave}520400005303986${textoValor}5802BR${textoNome}62070503***`;
    
    return `${payloadSemCRC}6304AAAA`; 
}

client.once('ready', () => {
    console.log(`Bot online como: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Comando !limpar
    if (message.content === '!limpar') {
        try {
            await message.delete().catch(() => {});
            const fetched = await message.channel.messages.fetch({ limit: 50 });
            for (const msg of fetched.values()) {
                await msg.delete().catch(() => {});
            }
        } catch (e) {
            console.log("Erro ao limpar mensagens:", e);
        }
        return;
    }

    if (!message.content.startsWith('!postar')) return;

    const args = message.content.split(' ');
    if (args.length < 3) {
        return message.reply('Use o formato correto: `!postar [1x1 ou 2x2] [valor]`');
    }

    const tipoModo = args[1];
    const valor = parseFloat(args[2]);

    if (isNaN(valor)) {
        return message.reply('❌ Por favor, insira um valor numérico válido.');
    }

    await message.delete().catch(() => {});

    const embed = new EmbedBuilder()
        .setTitle(`${tipoModo.toUpperCase()} | BLAND APOSTAS`)
        .setDescription(`🎮 Modo: ${tipoModo}\n💰 Valor: ${formatarMoeda(valor)}\n\n👥 **Nenhum jogador na fila**`)
        .setColor('#0099ff');

    const botoes = new ActionRowBuilder();

    if (tipoModo === '1x1') {
        botoes.addComponents(
            new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Gelo Normal`).setLabel('Gelo Normal').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Gelo Infinito`).setLabel('Gelo Infinito').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`sair|${tipoModo}|${valor}|Sair`).setLabel('Sair').setStyle(ButtonStyle.Secondary)
        );
    } else {
        botoes.addComponents(
            new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Normal`).setLabel('NORMAL').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Full Ump Xm8`).setLabel('FULL UMP XM8').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`sair|${tipoModo}|${valor}|Sair`).setLabel('Sair').setStyle(ButtonStyle.Secondary)
        );
    }

    await message.channel.send({ embeds: [embed], components: [botoes] });
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    // Tratamento para os botões da FILA principal (possuem o caractere pipe "|")
    if (interaction.customId.includes('|')) {
        await interaction.deferUpdate().catch(() => {});

        const partes = interaction.customId.split('|');
        if (partes.length < 4) return;

        const [acao, modo, valorStr, opcaoEscolhida] = partes;
        const valor = parseFloat(valorStr);
        const chaveFila = `${interaction.message.id}`;
        const usuarioId = interaction.user.id;

        if (!filas.has(chaveFila)) {
            filas.set(chaveFila, []);
        }
        let listaJogadores = filas.get(chaveFila);

        if (acao === 'entrar') {
            const jaEstaNestaFila = listaJogadores.some(j => j.id === usuarioId);
            if (jaEstaNestaFila) {
                return interaction.followUp({ content: '❌ Você já está nesta fila!', ephemeral: true });
            }

            let totalFilasAtivas = 0;
            for (const [outraChave, jogadores] of filas.entries()) {
                if (jogadores.some(j => j.id === usuarioId)) {
                    totalFilasAtivas++;
                }
            }

            if (totalFilasAtivas >= 3) {
                return interaction.followUp({ content: '❌ Você atingiu o limite máximo de 3 filas simultâneas!', ephemeral: true });
            }

            listaJogadores.push({ id: usuarioId, opcao: opcaoEscolhida });

        } else if (acao === 'sair') {
            const index = listaJogadores.findIndex(j => j.id === usuarioId);
            if (index !== -1) {
                listaJogadores.splice(index, 1);
            } else {
                return interaction.followUp({ content: '❌ Você não está nesta fila!', ephemeral: true });
            }
        }

        // Atualiza o visual da caixinha (Embed) com os nomes atualizados
        let textoJogadores = "👥 **Nenhum jogador na fila**";
        if (listaJogadores.length > 0) {
            textoJogadores = `👥 **Jogadores na Fila (${listaJogadores.length}/2):**\n` + 
                listaJogadores.map(j => `<@${j.id}> | ${j.opcao}`).join('\n');
        }

        const novoEmbed = new EmbedBuilder()
            .setTitle(`${modo.toUpperCase()} | BLAND APOSTAS`)
            .setDescription(`🎮 Modo: ${modo}\n💰 Valor: ${formatarMoeda(valor)}\n\n${textoJogadores}`)
            .setColor('#0099ff');

        await interaction.message.edit({ embeds: [novoEmbed] }).catch(() => {});

        // Quando fechar 2 jogadores, cria o canal privado automaticamente
        if (listaJogadores.length >= 2) {
            const player1 = listaJogadores[0];
            const player2 = listaJogadores[1];

            filas.set(chaveFila, []);

            // Reseta o embed visual da fila para vazio após fechar
            const embedVazio = new EmbedBuilder()
                .setTitle(`${modo.toUpperCase()} | BLAND APOSTAS`)
                .setDescription(`🎮 Modo: ${modo}\n💰 Valor: ${formatarMoeda(valor)}\n\n👥 **Nenhum jogador na fila**`)
                .setColor('#0099ff');

            await interaction.message.edit({ embeds: [embedVazio] }).catch(() => {});

            try {
                const guild = interaction.guild;

                const canalPrivado = await guild.channels.create({
                    name: `sala-${player1.opcao}-${player2.opcao}`.toLowerCase().replace(/\s/g, '-'),
                    type: ChannelType.GuildText,
                    parent: interaction.channel.parentId,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: player1.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: player2.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
                    ]
                });

                confirmadosPartida.set(canalPrivado.id, []);
                const mediadorId = interaction.user.id;

                const embedAposta = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Canal de aposta criado ✅')
                    .addFields(
                        { name: 'Modo:', value: `${player1.opcao} vs ${player2.opcao}`, inline: true },
                        { name: 'Valor:', value: `${formatarMoeda(valor)}`, inline: true },
                        { name: 'Mediador:', value: `<@${mediadorId}>`, inline: false },
                        { name: 'Jogadores:', value: `<@${player1.id}> e <@${player2.id}>`, inline: false }
                    )
                    .setDescription('⚠️ Ambos os jogadores precisam clicar em **Confirmar Aposta** para liberar os dados de pagamento.');

                const botoesAposta = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`confirmar_${player1.id}_${player2.id}_${valor}_${mediadorId}`)
                            .setLabel('Confirmar Aposta')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('cancelar_aposta')
                            .setLabel('Cancelar')
                            .setStyle(ButtonStyle.Danger)
                    );

                await canalPrivado.send({ content: `<@${player1.id}> <@${player2.id}>`, embeds: [embedAposta], components: [botoesAposta] });

            } catch (error) {
                console.error("Erro ao criar canal privado:", error);
            }
        }
        return;
    }

    // Fluxo de Confirmação Interna (Dentro do Canal Privado)
    if (interaction.customId.startsWith('confirmar_')) {
        await interaction.deferUpdate().catch(() => {});
        
        const partesConfirmar = interaction.customId.split('_');
        const p1Id = partesConfirmar[1];
