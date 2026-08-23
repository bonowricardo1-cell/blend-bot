const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const http = require('http');

const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SAMURAI E-SPORTS bot rodando normal e ativo!\n');
});

server.listen(PORT, () => {
    console.log(`Servidor HTTP ouvindo na porta ${PORT}`);
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

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

client.once('ready', () => {
    console.log(`Bot online como: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!limpar')) {
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

    const args = message.content.trim().split(/\s+/);
    if (args.length < 3) {
        return message.reply('Use o formato correto com espaço: `!postar 1x1 1.00`');
    }

    const tipoModo = args[1];
    const valor = parseFloat(args[2].replace(',', '.'));

    if (isNaN(valor)) {
        return message.reply('❌ Por favor, insira um valor numérico válido, ex: `!postar 1x1 1.00`');
    }

    await message.delete().catch(() => {});

    // Taxa fixa de 15 centavos para o ADM
    const taxaAdm = 0.15;

    const embed = new EmbedBuilder()
        .setTitle(`${tipoModo.toUpperCase()} | SAMURAI E-SPORTS`)
        .setThumbnail('https://i.imgur.com/7w3F4Gk.png') // Logo animada ao lado do card
        .setDescription(`🎮 Modo: ${tipoModo}\n💰 Aposta:\n${formatarMoeda(valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👥 **Nenhum jogador na fila**`)
        .setColor('#0099ff');

    const botoes = new ActionRowBuilder();

    if (tipoModo.toLowerCase() === '1x1') {
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

    if (interaction.customId.includes('|')) {
        const partes = interaction.customId.split('|');
        if (partes.length < 4) return;

        const [acao, modo, valorStr, opcaoEscolhida] = partes;
        const valor = parseFloat(valorStr);
        const taxaAdm = 0.15;
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

        let textoJogadores = "👥 **Nenhum jogador na fila**";
        if (listaJogadores.length > 0) {
            textoJogadores = `👥 **Jogadores na Fila (${listaJogadores.length}/1):**\n` + 
                listaJogadores.map(j => `<@${j.id}> | ${j.opcao}`).join('\n');
        }

        const novoEmbed = new EmbedBuilder()
            .setTitle(`${modo.toUpperCase()} | SAMURAI E-SPORTS`)
            .setThumbnail('https://i.imgur.com/7w3F4Gk.png')
            .setDescription(`🎮 Modo: ${modo}\n💰 Aposta:\n${formatarMoeda(valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n${textoJogadores}`)
            .setColor('#0099ff');

        await interaction.message.edit({ embeds: [novoEmbed] }).catch(() => {});

        // Teste: 1 jogador fecha a sala
        if (listaJogadores.length >= 1) {
            const player1 = listaJogadores[0];

            filas.set(chaveFila, []);

            const embedVazio = new EmbedBuilder()
                .setTitle(`${modo.toUpperCase()} | SAMURAI E-SPORTS`)
                .setThumbnail('https://i.imgur.com/7w3F4Gk.png')
                .setDescription(`🎮 Modo: ${modo}\n💰 Aposta:\n${formatarMoeda(valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👥 **Nenhum jogador na fila**`)
                .setColor('#0099ff');

            await interaction.message.edit({ embeds: [embedVazio] }).catch(() => {});

            try {
                const guild = interaction.guild;
                const admId = interaction.user.id;

                const canalPrivado = await guild.channels.create({
                    name: `sala-teste-${player1.opcao}`.toLowerCase().replace(/\s/g, '-'),
                    type: ChannelType.GuildText,
                    parent: interaction.channel.parentId,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: player1.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
                    ]
                });

                confirmadosPartida.set(canalPrivado.id, []);

                const numPartida = Math.floor(Math.random() * 900000) + 100000;

                const embedApostaCriada = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setThumbnail('https://i.imgur.com/7w3F4Gk.png')
                    .setTitle('Canal de aposta criado (Modo Teste) ✅')
                    .addFields(
                        { name: 'Partida:', value: `${numPartida}`, inline: false },
                        { name: 'Modo:', value: `${modo.toUpperCase()} - ${player1.opcao}`, inline: false },
                        { name: 'Valor da Aposta:', value: `${formatarMoeda(valor)}`, inline: false },
                        { name: 'Taxa ADM:', value: `${formatarMoeda(taxaAdm)}`, inline: false },
                        { name: 'Jogadores:', value: `<@${player1.id}> (Você testando sozinho)`, inline: false },
                        { name: 'Mediador:', value: `<@${admId}>`, inline: false }
                    );

                const botoesApostaCriada = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`confirmar_${player1.id}_${valor}_${admId}`)
                        .setLabel('Confirmar Teste')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('cancelar_aposta')
                        .setLabel('Cancelar')
                        .setStyle(ButtonStyle.Danger)
                );

                await canalPrivado.send({
                    content: `<@${player1.id}>`,
                    embeds: [embedApostaCriada],
                    components: [botoesApostaCriada]
                });
            } catch (e) {
                console.log("Erro ao criar canal privado:", e);
            }
        }
        return;
    }

    if (interaction.customId === 'cancelar_aposta') {
        await interaction.followUp({ content: '❌ Aposta cancelada.', ephemeral: true }).catch(() => {});
        setTimeout(async () => {
            await interaction.channel.delete().catch(() => {});
        }, 3000);
        return;
    }

    const partesCustomId = interaction.customId.split('_');
    const acao = partesCustomId[0];

    if (acao === 'confirmar') {
        const p1 = partesCustomId[1];
        const valorAposta = parseFloat(partesCustomId[2]);
        const taxaAdm = 0.15;
        const admId = partesCustomId[3];
        const canalId = interaction.channel.id;

        let listaConfirmados = confirmadosPartida.get(canalId) || [];

        if (listaConfirmados.includes(interaction.user.id)) {
            return interaction.followUp({ content: '⚠️ Você já confirmou esta partida!', ephemeral: true });
        }

        listaConfirmados.push(interaction.user.id);
        confirmadosPartida.set(canalId, listaConfirmados);

        const embedPagamento = new EmbedBuilder()
            .setColor('#00FF00')
            .setThumbnail('https://i.imgur.com/7w3F4Gk.png')
            .setTitle('💳 PAGAMENTO DA APOSTA LIBERADO (TESTE)!')
            .setDescription('Como você está testando sozinho, o fluxo liberou direto:')
            .addFields(
                { name: 'Valor da Aposta:', value: `${formatarMoeda(valorAposta)}`, inline: false },
                { name: 'Taxa do ADM:', value: `${formatarMoeda(taxaAdm)}`, inline: false },
                { name: 'Mediador responsável:', value: `<@${admId}>`, inline: false },
                { name: 'Chave Pix:', value: '`11999999999`', inline: false },
                { name: 'Nome completo:', value: 'Miguel Martins', inline: false }
            );

        await interaction.message.edit({
            content: `🔒 **TESTE APROVADO!** <@${p1}>`,
            embeds: [embedPagamento],
            components: []
        });
    }
});

client.login(process.env.TOKEN);
