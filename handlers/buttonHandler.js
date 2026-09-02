const { EmbedBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

async function handleButtonInteraction(
    interaction, 
    client, 
    confirmadosPartida, 
    pixConfig, 
    filaMediadores, 
    atualizarPainelMediadoresPorMensagem, 
    puxarProximoMediador, 
    atualizarPainelMisto, 
    formatarMoeda, 
    salvarPix
) {
    const { customId, user, message, guild } = interaction;
    if (!customId) return;

    if (interaction.isModalSubmit() && customId === 'modal_config_pix') {
        const chave = interaction.fields.getTextInputValue('input_chave_pix');
        const nome = interaction.fields.getTextInputValue('input_nome_pix');
        const mensagem = interaction.fields.getTextInputValue('input_msg_pix');

        pixConfig[user.id] = { chave, nome, mensagem };
        await salvarPix();

        return interaction.reply({
            content: `✅ **Configuração salva com sucesso!**\n\n🔑 **Chave:** \`${chave}\`\n👤 **Nome:** ${nome}\n📝 **Mensagem:** ${mensagem || 'Nenhuma'}`,
            ephemeral: true
        });
    }

    if (customId === 'btn_config_pix') {
        const modal = new ModalBuilder()
            .setCustomId('modal_config_pix')
            .setTitle('Configuração de Chave Pix');

        const inputChave = new TextInputBuilder()
            .setCustomId('input_chave_pix')
            .setLabel('Sua Chave Pix (Telefone, Email, CPF...)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const inputNome = new TextInputBuilder()
            .setCustomId('input_nome_pix')
            .setLabel('Nome Completo do Titular')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const inputMsg = new TextInputBuilder()
            .setCustomId('input_msg_pix')
            .setLabel('Mensagem opcional de pré-pagamento')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(inputChave),
            new ActionRowBuilder().addComponents(inputNome),
            new ActionRowBuilder().addComponents(inputMsg)
        );

        return interaction.showModal(modal);
    }

    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
    }

    // =========================================================================
    // FUNÇÃO PARA ENVIAR O PAINEL PROFISSIONAL DA PARTIDA + QR CODE VERMELHO
    // =========================================================================
    async function enviarPainelProfissionalPartida(canal, modoTexto, statusJogadoresTexto, valorAposta) {
        try {
            const mensagens = await canal.messages.fetch({ limit: 20 });
            await canal.bulkDelete(mensagens, true).catch(() => {});
        } catch (e) {
            console.error('Erro ao limpar mensagens do canal:', e);
        }

        const mediadorId = (filaMediadores && filaMediadores.length > 0) ? filaMediadores[0] : user.id;

        // 1. Embed Principal Profissional (Estilo Fila #1)
        const embedOficial = new EmbedBuilder()
            .setTitle(`Fila #1`)
            .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
            .setColor('#1f2023')
            .addFields(
                { name: 'Formato:', value: 'Freefire', inline: true },
                { name: 'Tipo:', value: 'Misto', inline: true },
                { name: 'Modo:', value: modoTexto, inline: true },
                { name: 'Seleção:', value: '1 Emu', inline: true },
                { name: 'Valor:', value: formatarMoeda(valorAposta), inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '👥 Jogadores', value: statusJogadoresTexto, inline: false },
                { name: '🛡️ Mediador', value: `<@${mediadorId}>`, inline: false }
            );

        const rowBotoesSala = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_painel_mediador')
                .setLabel('Painel do mediador')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔧'),
            new ButtonBuilder()
                .setCustomId('btn_liberar_pagamento')
                .setLabel('Liberar pagamento')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('btn_fornecer_sala')
                .setLabel('Fornecer sala')
                .setStyle(ButtonStyle.Secondary)
        );

        await canal.send({ embeds: [embedOficial], components: [rowBotoesSala] });

        // 2. Embed de Pagamento com QR Code Vermelho Funcional (Sem propagandas)
        const configPix = pixConfig[mediadorId] || Object.values(pixConfig)[0] || { chave: 'Não configurada', nome: 'SAMURAI E-SPORTS' };
        
        // URL da API gerando QR Code em vermelho vibrante com alta correção de erro (H)
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(configPix.chave)}&color=ff0000&bgcolor=ffffff&ecc=H`;

        const embedPix = new EmbedBuilder()
            .setColor('#1f2023')
            .setTitle('💰 Pagamento Liberado')
            .addFields(
                { name: 'Recebedor:', value: `\`${configPix.nome}\``, inline: false },
                { name: 'Valor:', value: formatarMoeda(valorAposta), inline: false }
            )
            .setDescription(`Escaneie o QR Code abaixo com o aplicativo do seu banco para realizar o pagamento.`)
            .setImage(qrCodeUrl);

        await canal.send({ embeds: [embedPix] });
    }

    async function criarCanalPrivadoEEnviarConfirmacao(jogadoresIds, modoTexto, valorAposta) {
        try {
            const permissionOverwrites = [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages],
                }
            ];

            for (const id of jogadoresIds) {
                permissionOverwrites.push({
                    id: id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                });
            }

            const nomeCanal = `partida-${Math.floor(Math.random() * 9000) + 1000}`;
            const canalPrivado = await guild.channels.create({
                name: nomeCanal,
                type: ChannelType.GuildText,
                parent: interaction.channel.parentId,
                permissionOverwrites: permissionOverwrites
            });

            const statusJogadores = jogadoresIds.map(id => `🔴 <@${id}>`).join('\n');
            const embedConfirmacao = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle(`SAMURAI E-SPORTS | Confirmação de Partida 🎮`)
                .setDescription(`🎮 Modo: ${modoTexto}\n💰 Aposta: ${formatarMoeda(valorAposta)}`)
                .addFields({ name: '👤 Jogadores', value: statusJogadores, inline: false })
                .setFooter({ text: 'Ambos os jogadores devem clicar em Confirmar para iniciar.' });

            const rowConfirm = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`btn_confirmar_${modoTexto.toLowerCase().replace(/\s+/g, '')}`)
                    .setLabel('Confirmar')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`btn_cancelar_partida_privada`)
                    .setLabel('Cancelar')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('✖️')
            );

            await canalPrivado.send({
                content: jogadoresIds.map(id => `<@${id}>`).join(' '),
                embeds: [embedConfirmacao],
                components: [rowConfirm]
            });

        } catch (error) {
            console.error('Erro ao criar canal privado de confirmação:', error);
        }
    }

    if (customId.startsWith('btn_confirmar_')) {
        const embed = message.embeds[0];
        if (!embed) return;

        const fieldJogadores = embed.fields.find(f => f.name.includes('Jogadores'));
        if (!fieldJogadores) return;

        let linhas = fieldJogadores.value.split('\n');
        let atualizou = false;

        linhas = linhas.map(linha => {
            if (linha.includes(user.id) && linha.includes('🔴')) {
                atualizou = true;
                return linha.replace('🔴', '🟢');
            }
            return linha;
        });

        if (!atualizou) {
            return interaction.followUp({ content: '⚠️ Você já confirmou ou não faz parte desta partida.', ephemeral: true }).catch(() => {});
        }

        const novoEmbed = EmbedBuilder.from(embed).setFields(
            { name: '👤 Jogadores', value: linhas.join('\n'), inline: false }
        );

        const todosConfirmaram = !linhas.some(l => l.includes('🔴'));

        if (todosConfirmaram) {
            const descOriginal = embed.description || '';
            let valorApostaMatch = descOriginal.match(/R\$\s*([\d,.]+)/);
            let valorAposta = valorApostaMatch ? parseFloat(valorApostaMatch[1].replace('.', '').replace(',', '.')) : 0;

            const jogadoresMencionados = linhas.map(l => {
                const match = l.match(/<@!?(\d+)>/);
                return match ? `<@${match[1]}>` : null;
            }).filter(Boolean).join(' vs ');

            await enviarPainelProfissionalPartida(interaction.channel, '2x2', jogadoresMencionados || 'Jogadores', valorAposta);
        } else {
            await message.edit({ embeds: [novoEmbed], components: message.components }).catch(() => {});
        }
        return;
    }

    if (customId === 'btn_liberar_pagamento') {
        const mediadorId = (filaMediadores && filaMediadores.length > 0) ? filaMediadores[0] : user.id;
        const configPix = pixConfig[mediadorId] || Object.values(pixConfig)[0] || { chave: 'Não configurada', nome: 'SAMURAI E-SPORTS' };
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(configPix.chave)}&color=ff0000&bgcolor=ffffff&ecc=H`;

        const embedPix = new EmbedBuilder()
            .setColor('#1f2023')
            .setTitle('💰 Pagamento Liberado (Reenviado)')
            .addFields(
                { name: 'Recebedor:', value: `\`${configPix.nome}\``, inline: false },
                { name: 'Valor:', value: 'R$ 0,65', inline: false }
            )
            .setDescription('Escaneie o QR Code abaixo com o aplicativo do seu banco.')
            .setImage(qrCodeUrl);

        await interaction.channel.send({ embeds: [embedPix] }).catch(() => {});
        return;
    }

    if (customId === 'btn_cancelar_partida_privada' || customId.includes('_cancelar')) {
        await interaction.channel.send('⚠️ Partida cancelada. Fechando canal em instantes...').catch(() => {});
        setTimeout(async () => {
            await interaction.channel.delete().catch(() => {});
        }, 2000);
        return;
    }

    if (customId === 'btn_painel_mediador') {
        const rowMediador = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_cancelar_fila')
                .setLabel('Cancelar fila')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('btn_finalizar_fila')
                .setLabel('Finalizar fila')
                .setStyle(ButtonStyle.Success)
        );

        await interaction.channel.send({
            content: `⚙️ **Painel do Mediador**\n> Selecione uma ação abaixo.`,
            components: [rowMediador]
        }).catch(() => {});
        return;
    }

    const { filasMistas, limitesFila } = require('../config/queues');
    let chaveFilaMista = customId.split('_')[0];

    if (filasMistas && filasMistas[chaveFilaMista]) {
        const fila = filasMistas[chaveFilaMista];
        const partes = customId.split('_');
        const acao = partes[1]; 

        if (acao === 'emu') {
            if (!filaMediadores || filaMediadores.length === 0) {
                return interaction.followUp({ 
                    content: '❌ **Atenção:** Não há nenhum mediador na fila no momento! Aguarde um ADM entrar para poder apostar.', 
                    ephemeral: true 
                }).catch(() => {});
            }

            if (!fila.emus) fila.emus = [];
            if (fila.emus.includes(user.id)) {
                return interaction.followUp({ content: '❌ Você já está nesta fila!', ephemeral: true }).catch(() => {});
            }

            let totalFilasUsuario = 0;
            for (const fKey in filasMistas) {
                if (filasMistas[fKey].emus && filasMistas[fKey].emus.includes(user.id)) totalFilasUsuario++;
            }
            if (global.filasGlobais) {
                for (const [fKey, lista] of global.filasGlobais.entries()) {
                    if (lista.some(j => j.id === user.id)) totalFilasUsuario++;
                }
            }
            if (totalFilasUsuario >= 3) {
                return interaction.followUp({ content: '❌ Você já atingiu o limite máximo de 3 filas simultâneas!', ephemeral: true }).catch(() => {});
            }

            if (fila.emus.length >= (fila.maxTotal || 2)) {
                return interaction.followUp({ content: '❌ As vagas já estão esgotadas!', ephemeral: true }).catch(() => {});
            }

            fila.emus.push(user.id);
            await interaction.followUp({ content: `✅ Vaga garantida!`, ephemeral: true }).catch(() => {});
            await atualizarPainelMisto(interaction, chaveFilaMista);

            if (fila.emus.length >= (fila.maxTotal || 2)) {
                const jogadoresPartida = [...fila.emus];
                fila.emus = []; 

                const taxaAdm = 0.15;
                const embedVazio = new EmbedBuilder()
                    .setTitle(`${fila.formato} | SAMURAI E-SPORTS`)
                    .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                    .setDescription(`🎮 Modo:\n${fila.formato}\n\n💰 Aposta:\n${formatarMoeda(fila.valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👤 Jogadores:\nNenhum jogador na fila`)
                    .setColor('#0099ff');

                await message.edit({ embeds: [embedVazio] }).catch(() => {});

                await criarCanalPrivadoEEnviarConfirmacao(jogadoresPartida, fila.formato, fila.valor);
            }

        } else if (acao === 'sair') {
            if (!fila.emus || !fila.emus.includes(user.id)) {
                return interaction.followUp({ content: '⚠️ Você não está nesta fila.', ephemeral: true }).catch(() => {});
            }
            fila.emus = fila.emus.filter(id => id !== user.id);
            await interaction.followUp({ content: '🚪 Você saiu da fila.', ephemeral: true }).catch(() => {});
            await atualizarPainelMisto(interaction, chaveFilaMista);
        }
        return;
    }

    if (customId.includes('|')) {
        const partes = customId.split('|');
        if (partes.length < 4) return;

        const [acao, modo, valorStr, opcaoEscolhida] = partes;
        const valor = parseFloat(valorStr);
        const taxaAdm = 0.15;
        const chaveFila = `${message.id}`;
        const maxJogadores = limitesFila[modo.toLowerCase()] || 2;

        if (!global.filasGlobais) global.filasGlobais = new Map();
        if (!global.filasGlobais.has(chaveFila)) global.filasGlobais.set(chaveFila, []);
        let listaJogadores = global.filasGlobais.get(chaveFila);

        if (acao === 'entrar') {
            if (!filaMediadores || filaMediadores.length === 0) {
                return interaction.followUp({ 
                    content: '❌ **Atenção:** Não há nenhum mediador na fila no momento! Aguarde um ADM entrar para poder apostar.', 
                    ephemeral: true 
                }).catch(() => {});
            }

            if (listaJogadores.some(j => j.id === user.id)) {
                return interaction.followUp({ content: '❌ Você já está nesta fila!', ephemeral: true }).catch(() => {});
            }

            let totalFilasUsuario = 0;
            for (const fKey in filasMistas) {
                if (filasMistas[fKey].emus && filasMistas[fKey].emus.includes(user.id)) totalFilasUsuario++;
            }
            for (const [fKey, lista] of global.filasGlobais.entries()) {
                if (lista.some(j => j.id === user.id)) totalFilasUsuario++;
            }
            if (totalFilasUsuario >= 3) {
                return interaction.followUp({ content: '❌ Você já atingiu o limite máximo de 3 filas simultâneas!', ephemeral: true }).catch(() => {});
            }

            listaJogadores.push({ id: user.id, opcao: opcaoEscolhida });
            await interaction.followUp({ content: '✅ Vaga garantida!', ephemeral: true }).catch(() => {});
        } else if (acao === 'sair') {
            const index = listaJogadores.findIndex(j => j.id === user.id);
            if (index !== -1) {
                listaJogadores.splice(index, 1);
                await interaction.followUp({ content: '🚪 Você saiu da fila.', ephemeral: true }).catch(() => {});
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

        await message.edit({ embeds: [novoEmbed] }).catch(() => {});

        if (listaJogadores.length >= maxJogadores) {
            const jogadoresPartida = [...listaJogadores];
            global.filasGlobais.set(chaveFila, []);

            const embedVazio = new EmbedBuilder()
                .setTitle(`${modo.toUpperCase()} | SAMURAI E-SPORTS`)
                .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                .setDescription(`🎮 Modo: ${modo}\n💰 Aposta:\n${formatarMoeda(valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👥 **Jogadores na Fila (0/${maxJogadores})**`)
                .setColor('#0099ff');

            await message.edit({ embeds: [embedVazio] }).catch(() => {});

            const idsJogadores = jogadoresPartida.map(j => j.id);
            await criarCanalPrivadoEEnviarConfirmacao(idsJogadores, modo, valor);
        }
        return;
    }

    if (['btn_entrar_fila', 'btn_sair_fila', 'btn_atualizar_fila', 'btn_reset_fila'].includes(customId)) {
        if (!filaMediadores) return;

        if (customId === 'btn_entrar_fila') {
            if (!filaMediadores.includes(user.id)) {
                filaMediadores.push(user.id);
            }
        } else if (customId === 'btn_sair_fila') {
            const idx = filaMediadores.indexOf(user.id);
            if (idx !== -1) {
                filaMediadores.splice(idx, 1);
            }
        } else if (customId === 'btn_reset_fila') {
            filaMediadores.length = 0;
        }

        if (typeof atualizarPainelMediadoresPorMensagem === 'function') {
            await atualizarPainelMediadoresPorMensagem(interaction.message);
        }
        return;
    }

    if (customId === 'btn_testar_pix') {
        const config = pixConfig[user.id] || Object.values(pixConfig)[0];
        if (!config || !config.chave) {
            return interaction.followUp({ content: '❌ Nenhuma chave Pix configurada!', ephemeral: true }).catch(() => {});
        }
        return interaction.followUp({ content: `🧪 **Pix OK!** Chave: \`${config.chave}\``, ephemeral: true }).catch(() => {});
    }

    if (customId === 'fechar_ticket') {
        await interaction.followUp({ content: '🔒 Fechando canal em instantes...', ephemeral: true }).catch(() => {});
        setTimeout(async () => {
            await interaction.channel.delete().catch(() => {});
        }, 3000);
        return;
    }
}

module.exports = { handleButtonInteraction };
