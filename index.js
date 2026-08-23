const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const filas = new Map();
const confirmadosPartida = new Map();

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

client.once('ready', () => {
    console.log(`Bot online como: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

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

    // Se fechar 2 jogadores, cria o canal privado automaticamente
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
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: player1.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                },
                {
                    id: player2.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                },
                {
                    id: client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
                }
            ]
        });

        // Inicializa a lista de confirmados vazia para este novo canal
        confirmadosPartida.set(canalPrivado.id, []);

        // Monta o Embed Profissional da Aposta
        const embedAposta = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Canal de aposta criado ✅')
            .addFields(
                { name: 'Modo:', value: `${player1.opcao}`, inline: false },
                { name: 'Valor:', value: `R$ ${formatarMoeda(valor)}`, inline: false },
                { name: 'Jogadores:', value: `<@${player1.id}>, <@${player2.id}>`, inline: false },
                { name: 'Mediador:', value: `<@${interaction.user.id}>`, inline: false }
            );

        // Cria os botões de Confirmar e Cancelar
        const botoesAposta = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirmar_${player1.id}_${player2.id}_${interaction.user.id}`)
                    .setLabel('Confirmar')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('cancelar_aposta')
                    .setLabel('Cancelar')
                    .setStyle(ButtonStyle.Danger)
            );

        // Envia o painel com os botões no canal privado recém-criado
        await canalPrivado.send({
            content: `<@${player1.id}>, <@${player2.id}>, <@${interaction.user.id}>`,
            embeds: [embedAposta],
            components: [botoesAposta]
        });

    } catch (e) {
        console.log("Erro ao criar canal privado:", e);
    }

client.login(process.env.DISCORD_TOKEN);
const http = require('http');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('BLAND bot rodando normal!\n');
});

server.listen(PORT, () => {
  console.log(`Servidor HTTP ouvindo na porta ${PORT}`);
});
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const [acao, p1, p2, admId] = interaction.customId.split('_');
    const canalId = interaction.channel.id;

    if (interaction.customId === 'cancelar_aposta') {
        await interaction.reply({ content: '❌ Aposta cancelada.', ephemeral: true });
        return;
    }

    if (acao === 'confirmar') {
        if (interaction.user.id !== p1 && interaction.user.id !== p2) {
            return interaction.reply({ content: '❌ Apenas os jogadores da partida podem confirmar!', ephemeral: true });
        }

        let listaConfirmados = confirmadosPartida.get(canalId) || [];

        if (listaConfirmados.includes(interaction.user.id)) {
            return interaction.reply({ content: '⚠️ Você já confirmou esta partida!', ephemeral: true });
        }

        listaConfirmados.push(interaction.user.id);
        confirmadosPartida.set(canalId, listaConfirmados);

        if (listaConfirmados.length < 2) {
            return interaction.reply({ 
                content: `✅ Confirmação registrada! Falta 1 jogador confirmar.`, 
                ephemeral: true 
            });
        }

        const embedPagamento = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('💳 PAGAMENTO DA APOSTA LIBERADO!')
            .setDescription('Ambos os jogadores confirmaram. Façam o Pix para o mediador abaixo:')
            .addFields(
                { name: 'Mediador responsável:', value: `<@${admId}>`, inline: false },
                { name: 'Chave Pix:', value: '`11999999999`', inline: false },
                { name: 'Nome completo:', value: 'Miguel Martins', inline: false }
            )
            .setImage('https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg');

        await interaction.update({
            content: `🔒 **AMBOS CONFIRMARAM!** <@${p1}> e <@${p2}>`,
            embeds: [embedPagamento],
            components: []
        });
    }
});
