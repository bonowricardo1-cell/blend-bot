const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionsBitField } = require('discord.js');
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
const CARGO_SUPORTE_ID = '1541235665960833145';

const limitesFila = {
    '1x1': 2,
    '2x2': 4,
    '3x3': 6,
    '4x4': 8
};

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

    if (message.content.startsWith('!ticket')) {
        await message.delete().catch(() => {});

        const embedTicket = new EmbedBuilder()
            .setTitle('SAMURAI E-SPORTS | Central de Atendimento 🎫')
            .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
            .setDescription('📂 Seja bem-vindo(a) ao sistema de atendimento! Aqui você pode abrir um ticket de forma rápida e organizada.\n\n👇 **Selecione uma das opções no menu abaixo para iniciar seu atendimento e aguarde que nossa equipe irá te responder o mais breve possível.**')
            .setColor('#0099ff');

        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('criar_ticket')
                .setPlaceholder('Selecione o ticket que deseja abrir')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Suporte')
                        .setDescription('Auxílio, ajudas, dúvidas e propostas...')
                        .setValue('suporte')
                        .setEmoji('💬'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Reembolso')
                        .setDescription('Adm pagou errado, sumiu e precisa de reembolso.')
                        .setValue('reembolso')
                        .setEmoji('💳'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Seja Mediador')
                        .setDescription('Abra ticket aqui para fazer parte da equipe.')
                        .setValue('seja_mediador')
                        .setEmoji('🛡️'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Divulgação')
                        .setDescription('Caso queira uma divulgação.')
                        .setValue('divulgacao')
                        .setEmoji('📢')
                )
        );

        await message.channel.send({ embeds: [embedTicket], components: [menuRow] });
        return;
    }

    if (!message.content.startsWith('!postar')) return;

    const args = message.content.trim().split(/\s+/);
    if (args.length < 3) {
        return message.reply('Use o formato correto com espaço: `!postar 1x1 2.00`');
    }

    const tipoModo = args[1];
    const valor = parseFloat(args[2].replace(',', '.'));

    if (isNaN(valor)) {
        return message.reply('❌ Por favor, insira um valor numérico válido, ex: `!postar 1x1 2.00`');
    }

    await message.delete().catch(() => {});
    const taxaAdm = 0.15;
    const maxJogadores = limitesFila[tipoModo.toLowerCase()] || 2;

    const embed = new EmbedBuilder()
        .setTitle(`${tipoModo.toUpperCase()} | SAMURAI E-SPORTS`)
        .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
        .setDescription(`🎮 Modo: ${tipoModo}\n💰 Aposta:\n${formatarMoeda(valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👥 **Jogadores na Fila (0/${maxJogadores})**`)
        .setColor('#0099ff');

    const botoes = new ActionRowBuilder();

    if (tipoModo.toLowerCase().includes('1x1')) {
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
    if (interaction.isStringSelectMenu() && interaction.customId === 'criar_ticket') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => {});
        }

        const tipoTicket = interaction.values[0];
        const guild = interaction.guild;
        const usuario = interaction.user;

        try {
            const canalTicket = await guild.channels.create({
                name: `ticket-${tipoTicket}-${usuario.username}`.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                type: ChannelType.GuildText,
                parent: interaction.channel.parentId,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: usuario.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: CARGO_SUPORTE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
                ]
            });

            const embedTicketAberto = new EmbedBuilder()
                .setColor('#0099ff')
                .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                .setTitle(`SAMURAI E-SPORTS | Ticket - ${tipoTicket.toUpperCase()}`)
                .setDescription(`Olá <@${usuario.id}>, seu ticket foi aberto com sucesso!\n\nAguarde um momento e nossa equipe de suporte (<@&${CARGO_SUPORTE_ID}>) já irá lhe atender.`);

            const botaoFechar = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('fechar_ticket')
                    .setLabel('Fechar Ticket')
                    .setStyle(ButtonStyle.Danger)
            );

            await canalTicket.send({
                content: `<@${usuario.id}> | <@&${CARGO_SUPORTE_ID}>`,
                embeds: [embedTicketAberto],
                components: [botaoFechar]
            });

            await interaction.followUp({ content: `✅ Seu ticket foi criado com sucesso em: <#${canalTicket.id}>`, ephemeral: true }).catch(() => {});
        } catch (e) {
            console.log("Erro ao criar canal de ticket:", e);
            await interaction.followUp({ content: '❌ Ocorreu um erro ao criar o seu ticket.', ephemeral: true }).catch(() => {});
        }
        return;
    }

    if (interaction.isButton() && interaction.customId === 'fechar_ticket') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => {});
        }
        await interaction.followUp({ content: '🔒 Este ticket será fechado em 3 segundos...', ephemeral: true }).catch(() => {});
        setTimeout(async () => {
            await interaction.channel.delete().catch(() => {});
        }, 3000);
        return;
    }

    if (!interaction.isButton()) return;

    if (interaction.customId === 'cancelar_aposta') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => {});
        }
        await interaction.followUp({ content: '❌ Aposta cancelada.', ephemeral: true }).catch(() => {});
        setTimeout(async () => {
            await interaction.channel.delete().catch(() => {});
        }, 3000);
        return;
    }

    const partesCustomId = interaction.customId.split('_');
    const acaoConfirmar = partesCustomId[0];

    if (acaoConfirmar === 'confirmar') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => {});
        }
        const valorAposta = parseFloat(partesCustomId[2]);
        const taxaAdm = 0.15;
        const admId = partesCustomId[3];
        const canalId = interaction.channel.id;

        let listaConfirmados = confirmadosPartida.get(canalId) || [];

        if (listaConfirmados.includes(interaction.user.id)) {
            return interaction.followUp({ content: '⚠️ Você já confirmou esta partida!', ephemeral: true }).catch(() => {});
        }

        listaConfirmados.push(interaction.user.id);
        confirmadosPartida.set(canalId, listaConfirmados);

        const embedPagamento = new EmbedBuilder()
            .setColor('#00FF00')
            .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
            .setTitle('SAMURAI E-SPORTS | Pagamento Liberado 💳')
            .setDescription('Fluxo de pagamento pronto para o confronto:')
            .addFields(
                { name: 'Valor da Aposta:', value: `${formatarMoeda(valorAposta)}`, inline: false },
                { name: 'Taxa do ADM:', value: `${formatarMoeda(taxaAdm)}`, inline: false },
                { name: 'Mediador responsável:', value: `<@${admId}>`, inline: false },
                { name: 'Chave Pix:', value: '`11999999999`', inline: false },
                { name: 'Nome completo:', value: 'Miguel Martins', inline: false }
            );

        await interaction.message.edit({
            content: `🔒 **PARTIDA CONFIRMADA!**`,
            embeds: [embedPagamento],
            components: []
        }).catch(() => {});
        return;
    }

    let chaveFilaMista = interaction.customId.split('_')[0];
    if (filasMistas[chaveFilaMista]) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => {});
        }

        const fila = filasMistas[chaveFilaMista];
        const partes = interaction.customId.split('_');
        const acao = partes[1]; 
        const usuario = interaction.user;

        if (acao === 'emu') {
            if (fila.emus.includes(usuario.id)) {
                return interaction.followUp({ content: '❌ Você já está nesta fila!', ephemeral: true });
            }
            if (fila.emus.length >= fila.maxEmu) {
                return interaction.followUp({ content: '❌ As vagas de Emulador já estão esgotadas neste painel!', ephemeral: true });
            }

            fila.emus.push(usuario.id);
            await interaction.followUp({ content: `✅ Vaga de Emulador garantida! (${fila.emus.length}/${fila.maxEmu})`, ephemeral: true });

            await atualizarPainelMisto(interaction, chaveFilaMista);
            await verificarEFecharFilaMista(interaction, chaveFilaMista);

        } else if (acao === 'sair') {
            const estavaNosEmu = fila.emus.includes(usuario.id);

            if (!estavaNosEmu) {
                return interaction.followUp({ content: '⚠️ Você não está nesta fila.', ephemeral: true });
            }

            fila.emus = fila.emus.filter(id => id !== usuario.id);

            await interaction.followUp({ content: '🚪 Você saiu da fila com sucesso.', ephemeral: true });
            await atualizarPainelMisto(interaction, chaveFilaMista);
        }
        return;
    }

    if (interaction.customId.includes('|')) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => {});
        }
        
        const partes = interaction.customId.split('|');
        if (partes.length < 4) return;

        const [acao, modo, valorStr, opcaoEscolhida] = partes;
        const valor = parseFloat(valorStr);
        const taxaAdm = 0.15;
        const chaveFila = `${interaction.message.id}`;
        const usuarioId = interaction.user.id;
        const maxJogadores = limitesFila[modo.toLowerCase()] || 2;

        if (!filas.has(chaveFila)) {
            filas.set(chaveFila, []);
        }
        let listaJogadores = filas.get(chaveFila);

        if (acao === 'entrar') {
            const jaEstaNestaFila = listaJogadores.some(j => j.id === usuarioId);
            if (jaEstaNestaFila) {
                return interaction.followUp({ content: '❌ Você já está nesta fila!', ephemeral: true }).catch(() => {});
            }

            let totalFilasAtivas = 0;
            for (const [, jogadores] of filas.entries()) {
                if (jogadores.some(j => j.id === usuarioId)) {
                    totalFilasAtivas++;
                }
            }

            if (totalFilasAtivas >= 3) {
                return interaction.followUp({ content: '❌ Você atingiu o limite máximo de 3 filas simultâneas!', ephemeral: true }).catch(() => {});
            }

            listaJogadores.push({ id: usuarioId, opcao: opcaoEscolhida });

        } else if (acao === 'sair') {
            const index = listaJogadores.findIndex(j => j.id === usuarioId);
            if (index !== -1) {
                listaJogadores.splice(index, 1);
            } else {
                return interaction.followUp({ content: '❌ Você não está nesta fila!', ephemeral: true }).catch(() => {});
            }
        }

        let textoJogadores = `👥 **Jogadores na Fila (0/${maxJogadores})**`;
        if (listaJogadores.length > 0) {
            textoJogadores = `👥 **Jogadores na Fila (${listaJogadores.length}/${maxJogadores}):**\n` + 
                listaJogadores.map(j => `<@${j.id}> | ${j.opcao}`).join('\n');
        }

        const novoEmbed = new EmbedBuilder()
            .setTitle(`${modo.toUpperCase()} | SAMURAI E-SPORTS`)
            .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
            .setDescription(`🎮 Modo: ${modo}\n💰 Aposta:\n${formatarMoeda(valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n${textoJogadores}`)
            .setColor('#0099ff');

        await interaction.message.edit({ embeds: [novoEmbed] }).catch(() => {});

        if (listaJogadores.length >= maxJogadores) {
            const jogadoresPartida = [...listaJogadores];

            filas.set(chaveFila, []);

            const embedVazio = new EmbedBuilder()
                .setTitle(`${modo.toUpperCase()} | SAMURAI E-SPORTS`)
                .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                .setDescription(`🎮 Modo: ${modo}\n💰 Aposta:\n${formatarMoeda(valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👥 **Jogadores na Fila (0/${maxJogadores})**`)
                .setColor('#0099ff');

            await interaction.message.edit({ embeds: [embedVazio] }).catch(() => {});

            try {
                const guild = interaction.guild;
                const admId = interaction.user.id;

                const canalPrivado = await guild.channels.create({
                    name: `sala-${modo}`.toLowerCase().replace(/\s/g, '-'),
                    type: ChannelType.GuildText,
                    parent: interaction.channel.parentId,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        ...jogadoresPartida.map(p => ({
                            id: p.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                        })),
                        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
                    ]
                });

                confirmadosPartida.set(canalPrivado.id, []);

                const numPartida = Math.floor(Math.random() * 900000) + 100000;

                const embedApostaCriada = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                    .setTitle('SAMURAI E-SPORTS | Canal de Aposta ✅')
                    .addFields(
                        { name: 'Partida:', value: `${numPartida}`, inline: false },
                        { name: 'Modo:', value: `${modo.toUpperCase()}`, inline: false },
                        { name: 'Valor da Aposta:', value: `${formatarMoeda(valor)}`, inline: false },
                        { name: 'Taxa ADM:', value: `${formatarMoeda(taxaAdm)}`, inline: false },
                        { name: 'Jogadores:', value: `${jogadoresPartida.map(p => `<@${p.id}>`).join(', ')}`, inline: false },
                        { name: 'Mediador:', value: `<@${admId}>`, inline: false }
                    );

                const botoesApostaCriada = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`confirmar_${jogadoresPartida[0].id}_${valor}_${admId}`)
                        .setLabel('Confirmar')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('cancelar_aposta')
                        .setLabel('Cancelar')
                        .setStyle(ButtonStyle.Danger)
                );

                await canalPrivado.send({
                    content: `${jogadoresPartida.map(p => `<@${p.id}>`).join(' ')}`,
                    embeds: [embedApostaCriada],
                    components: [botoesApostaCriada]
                });
            } catch (e) {
                console.log("Erro ao criar canal privado:", e);
            }
        }
        return;
    }
});

// ==========================================
// SISTEMA DE FILAS MISTAS E PAINÉIS
// ==========================================

const filasMistas = {
    '2x2-misto': { formato: '2x2 Misto', valor: 5.00, maxEmu: 2, maxTotal: 2, emus: [] },
    '3x3-misto': { formato: '3x3 Misto', valor: 5.00, maxEmu: 3, maxTotal: 3, emus: [] },
    '4x4-misto': { formato: '4x4 Misto', valor: 5.00, maxEmu: 4, maxTotal: 4, emus: [] }
};

async function atualizarPainelMisto(interaction, chaveFila) {
    try {
        const fila = filasMistas[chaveFila];
        const mensagem = interaction.message;
        const embedOriginal = mensagem.embeds[0];

        if (!embedOriginal) return;

        let listaTexto = `Jogadores:\nNenhum jogador na fila`;
        if (fila.emus.length > 0) {
            listaTexto = `Jogadores:\n` + fila.emus.map(id => `<@${id}> | ${fila.emus.indexOf(id) + 1} Emu`).join('\n');
        }

        const taxaAdm = 0.15;
        const embedAtualizada = new EmbedBuilder()
            .setTitle(`${fila.formato} | SAMURAI E-SPORTS`)
            .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
            .setDescription(`🎮 Modo:\n${fila.formato}\n\n💰 Valor:\n${formatarMoeda(fila.valor)}\n\n👤 ${listaTexto}`)
            .setColor('#0099ff');

        const linha = new ActionRowBuilder();
        for (let i = 1; i <= fila.maxEmu; i++) {
            linha.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${chaveFila}_emu_${i}`)
                    .setLabel(`${i}º Emu`)
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        linha.addComponents(
            new ButtonBuilder()
                .setCustomId(`${chaveFila}_sair`)
                .setLabel('Sair da fila')
                .setStyle(ButtonStyle.Danger)
        );

        await mensagem.edit({ embeds: [embedAtualizada], components: [linha] });
    } catch (err) {
        console.error('Erro ao atualizar painel misto:', err);
    }
}

async function verificarEFecharFilaMista(interaction, chaveFila) {
    const fila = filasMistas[chaveFila];

    if (fila.emus.length >= fila.maxTotal) {
        const guild = interaction.guild;
        const todosJogadores = [...fila.emus];

        try {
            const categoriaDestino = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory);

            const canalPrivado = await guild.channels.create({
                name: `⛩️-partida-${chaveFila}-${Math.floor(Math.random() * 900 + 100)}`,
                type: ChannelType.GuildText,
                parent: categoriaDestino ? categoriaDestino.id : null,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    ...todosJogadores.map(id => ({
                        id: id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    }))
                ]
            });

            const numPartida = Math.floor(Math.random() * 900000) + 100000;
            const taxaAdm = 0.15;
            const admId = interaction.user.id;

            const embedApostaCriada = new EmbedBuilder()
                .setColor('#0099ff')
                .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                .setTitle('SAMURAI E-SPORTS | Canal de Aposta ✅')
                .addFields(
                    { name: 'Partida:', value: `${numPartida}`, inline: false },
                    { name: 'Modo:', value: `${fila.formato.toUpperCase()}`, inline: false },
                    { name: 'Valor da Aposta:', value: `${formatarMoeda(fila.valor)}`, inline: false },
                    { name: 'Taxa ADM:', value: `${formatarMoeda(taxaAdm * fila.valor)}`, inline: false },
                    { name: 'Jogadores:', value: `${todosJogadores.map(id => `<@${id}>`).join(', ')}`, inline: false },
                    { name: 'Mediador:', value: `<@${admId}>`, inline: false }
                );

            const botoesApostaCriada = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirmar_${todosJogadores[0]}_${fila.valor}_${admId}`)
                    .setLabel('Confirmar')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('cancelar_aposta')
                    .setLabel('Cancelar')
                    .setStyle(ButtonStyle.Danger)
            );

            confirmadosPartida.set(canalPrivado.id, []);

            await canalPrivado.send({
                content: `${todosJogadores.map(id => `<@${id}>`).join(' ')}`,
                embeds: [embedApostaCriada],
                components: [botoesApostaCriada]
            });
            
            fila.emus = [];
            await interaction.message.delete().catch(() => {});

        } catch (err) {
            console.error('Erro ao criar canal privado da partida:', err);
        }
    }
}

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!painel')) {
        const argumentos = message.content.split(' ');
        const tipo = argumentos[1];
        const valorArg = parseFloat((argumentos[2] || '5.00').replace(',', '.'));

        if (!filasMistas[tipo]) {
            return message.reply('❌ Tipo inválido. Use: `!painel 2x2-misto 5.00`, `!painel 3x3-misto 5.00` ou `!painel 4x4-misto 5.00`.');
        }

        const configuracao = filasMistas[tipo];
        configuracao.valor = isNaN(valorArg) ? 5.00 : valorArg;

        const embedPainel = new EmbedBuilder()
            .setTitle(`${configuracao.formato} | SAMURAI E-SPORTS`)
            .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
            .setDescription(`🎮 Modo:\n${configuracao.formato}\n\n💰 Valor:\n${formatarMoeda(configuracao.valor)}\n\n👤 Jogadores:\nNenhum jogador na fila`)
            .setColor('#0099ff');

        const linha = new ActionRowBuilder();
        for (let i = 1; i <= configuracao.maxEmu; i++) {
            linha.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${tipo}_emu_${i}`)
                    .setLabel(`${i}º Emu`)
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        linha.addComponents(
            new ButtonBuilder()
                .setCustomId(`${tipo}_sair`)
                .setLabel('Sair da fila')
                .setStyle(ButtonStyle.Danger)
        );

        await message.channel.send({ embeds: [embedPainel], components: [linha] });
        await message.delete().catch(() => {});
    }
});

client.login(process.env.DISCORD_TOKEN);
