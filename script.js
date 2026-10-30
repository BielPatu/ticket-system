'use strict';

/*
 * Ticketing System
 * JavaScript puro: cadastro, persistência local, métricas,
 * filtros e atualização de status.
 */

(() => {
    const STORAGE_KEY = 'ticketing-system-tickets-v1';

    const STATUS = [
        'Aberto',
        'Em andamento',
        'Aguardando resposta',
        'Resolvido'
    ];

    const CATEGORIES = [
        'Suporte Técnico',
        'Infraestrutura',
        'Software',
        'Outro'
    ];

    const PRIORITIES = ['Baixa', 'Média', 'Alta'];

    const $ = (selector) => document.querySelector(selector);

    const ui = {
        pageTitle: $('#page-title'),

        views: {
            dashboard: $('#dashboard-view'),
            tickets: $('#tickets-view'),
            'new-ticket': $('#new-ticket-view')
        },

        navItems: document.querySelectorAll('.nav-item'),

        total: $('#metric-total'),
        progress: $('#metric-progress'),
        resolved: $('#metric-resolved'),
        waiting: $('#metric-waiting'),

        recentBody: $('#recent-tickets-body'),
        ticketsBody: $('#tickets-body'),

        recentEmpty: $('#recent-empty'),
        ticketsEmpty: $('#tickets-empty'),

        resultCount: $('#result-count'),

        form: $('#ticket-form'),
        title: $('#ticket-title'),
        category: $('#ticket-category'),
        priority: $('#ticket-priority'),
        description: $('#ticket-description'),
        descriptionCounter: $('#description-counter'),

        search: $('#search-input'),
        filterStatus: $('#filter-status'),
        filterCategory: $('#filter-category'),
        filterStart: $('#filter-start'),
        filterEnd: $('#filter-end'),

        toast: $('#toast'),
        sidebar: $('#sidebar')
    };

    let tickets = loadTickets();
    let toastTimer = null;

    // =========================================================
    // PERSISTÊNCIA
    // =========================================================

    function loadTickets() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);

            if (!stored) {
                return [];
            }

            const parsed = JSON.parse(stored);

            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed.filter((ticket) => {
                return (
                    ticket &&
                    typeof ticket.id === 'string' &&
                    typeof ticket.title === 'string' &&
                    typeof ticket.description === 'string' &&
                    CATEGORIES.includes(ticket.category) &&
                    PRIORITIES.includes(ticket.priority) &&
                    STATUS.includes(ticket.status) &&
                    typeof ticket.createdAt === 'string'
                );
            });
        } catch (error) {
            console.error(
                'Erro ao carregar os chamados:',
                error
            );

            return [];
        }
    }

    function saveTickets() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(tickets)
            );

            return true;
        } catch (error) {
            console.error(
                'Erro ao salvar os chamados:',
                error
            );

            showToast(
                'Não foi possível salvar os dados no navegador.',
                true
            );

            return false;
        }
    }

    // =========================================================
    // FUNÇÕES AUXILIARES
    // =========================================================

    function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, (character) => {
            const entities = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };

            return entities[character];
        });
    }

    function generateTicketId() {
        const timestamp = Date.now()
            .toString(36)
            .toUpperCase();

        const random = Math.random()
            .toString(36)
            .slice(2, 7)
            .toUpperCase();

        return `CH-${timestamp}-${random}`;
    }

    function formatDate(dateString) {
        const date = new Date(dateString);

        if (Number.isNaN(date.getTime())) {
            return 'Data inválida';
        }

        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        })
            .format(date)
            .replace('.', '');
    }

    function normalizeClass(value) {
        return value
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-');
    }

    function showToast(message, isError = false) {
        window.clearTimeout(toastTimer);

        ui.toast.textContent = message;

        ui.toast.classList.toggle(
            'error',
            isError
        );

        ui.toast.classList.add('show');

        toastTimer = window.setTimeout(() => {
            ui.toast.classList.remove('show');
        }, 3200);
    }

    // =========================================================
    // RENDERIZAÇÃO DOS CHAMADOS
    // =========================================================

    function createStatusSelect(ticket) {
        const options = STATUS.map((status) => {
            const selected =
                status === ticket.status ? 'selected' : '';

            return `
                <option
                    value="${status}"
                    ${selected}
                >
                    ${status}
                </option>
            `;
        }).join('');

        return `
            <select
                class="action-select"
                data-ticket-status="${escapeHTML(ticket.id)}"
                aria-label="Alterar status do chamado ${escapeHTML(ticket.id)}"
            >
                ${options}
            </select>
        `;
    }

    function createTicketRow(ticket) {
        const priorityClass = normalizeClass(ticket.priority);
        const statusClass = normalizeClass(ticket.status);

        return `
            <tr>
                <td class="ticket-cell">
                    <strong title="${escapeHTML(ticket.title)}">
                        ${escapeHTML(ticket.title)}
                    </strong>

                    <small>
                        ${escapeHTML(ticket.id)}
                    </small>
                </td>

                <td>
                    ${escapeHTML(ticket.category)}
                </td>

                <td>
                    <span class="priority priority-${priorityClass}">
                        ${escapeHTML(ticket.priority)}
                    </span>
                </td>

                <td>
                    <span class="status status-${statusClass}">
                        ${escapeHTML(ticket.status)}
                    </span>
                </td>

                <td>
                    ${formatDate(ticket.createdAt)}
                </td>

                <td>
                    ${createStatusSelect(ticket)}
                </td>
            </tr>
        `;
    }

    // =========================================================
    // DASHBOARD E MÉTRICAS
    // =========================================================

    function updateMetrics() {
        const total = tickets.length;

        const progress = tickets.filter((ticket) => {
            return ticket.status === 'Em andamento';
        }).length;

        const resolved = tickets.filter((ticket) => {
            return ticket.status === 'Resolvido';
        }).length;

        const waiting = tickets.filter((ticket) => {
            return ticket.status === 'Aguardando resposta';
        }).length;

        ui.total.textContent = total;
        ui.progress.textContent = progress;
        ui.resolved.textContent = resolved;
        ui.waiting.textContent = waiting;
    }

    function renderRecentTickets() {
        const recentTickets = [...tickets]
            .sort((a, b) => {
                return (
                    new Date(b.createdAt) -
                    new Date(a.createdAt)
                );
            })
            .slice(0, 5);

        ui.recentBody.innerHTML = recentTickets
            .map(createTicketRow)
            .join('');

        ui.recentEmpty.classList.toggle(
            'hidden',
            recentTickets.length > 0
        );
    }

    // =========================================================
    // PESQUISA E FILTROS
    // =========================================================

    function getFilteredTickets() {
        const query = ui.search.value
            .trim()
            .toLocaleLowerCase('pt-BR');

        const selectedStatus = ui.filterStatus.value;
        const selectedCategory = ui.filterCategory.value;
        const startDate = ui.filterStart.value;
        const endDate = ui.filterEnd.value;

        return [...tickets]
            .filter((ticket) => {
                const searchableText = [
                    ticket.id,
                    ticket.title,
                    ticket.description
                ]
                    .join(' ')
                    .toLocaleLowerCase('pt-BR');

                const ticketDate = ticket.createdAt.slice(0, 10);

                const matchesSearch =
                    !query || searchableText.includes(query);

                const matchesStatus =
                    !selectedStatus ||
                    ticket.status === selectedStatus;

                const matchesCategory =
                    !selectedCategory ||
                    ticket.category === selectedCategory;

                const matchesStartDate =
                    !startDate || ticketDate >= startDate;

                const matchesEndDate =
                    !endDate || ticketDate <= endDate;

                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesCategory &&
                    matchesStartDate &&
                    matchesEndDate
                );
            })
            .sort((a, b) => {
                return (
                    new Date(b.createdAt) -
                    new Date(a.createdAt)
                );
            });
    }

    function renderTickets() {
        const filteredTickets = getFilteredTickets();

        ui.ticketsBody.innerHTML = filteredTickets
            .map(createTicketRow)
            .join('');

        ui.ticketsEmpty.classList.toggle(
            'hidden',
            filteredTickets.length > 0
        );

        const count = filteredTickets.length;

        ui.resultCount.textContent =
            `${count} ${
                count === 1
                    ? 'chamado encontrado'
                    : 'chamados encontrados'
            }`;
    }

    function renderAll() {
        updateMetrics();
        renderRecentTickets();
        renderTickets();
    }

    function clearFilters() {
        ui.search.value = '';
        ui.filterStatus.value = '';
        ui.filterCategory.value = '';
        ui.filterStart.value = '';
        ui.filterEnd.value = '';

        renderTickets();
    }

    // =========================================================
    // NAVEGAÇÃO
    // =========================================================

    function navigate(viewName) {
        if (!ui.views[viewName]) {
            return;
        }

        Object.entries(ui.views).forEach(([name, view]) => {
            view.classList.toggle(
                'hidden',
                name !== viewName
            );
        });

        ui.navItems.forEach((item) => {
            item.classList.toggle(
                'active',
                item.dataset.view === viewName
            );
        });

        const titles = {
            dashboard: 'Dashboard',
            tickets: 'Todos os chamados',
            'new-ticket': 'Abrir chamado'
        };

        ui.pageTitle.textContent = titles[viewName];

        ui.sidebar.classList.remove('open');

        if (viewName === 'tickets') {
            renderTickets();
        }

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    // =========================================================
    // VALIDAÇÃO DO FORMULÁRIO
    // =========================================================

    function clearValidationErrors() {
        const errorIds = [
            'title-error',
            'category-error',
            'priority-error',
            'description-error'
        ];

        errorIds.forEach((id) => {
            const errorElement = document.getElementById(id);

            if (errorElement) {
                errorElement.textContent = '';
            }
        });

        [
            ui.title,
            ui.category,
            ui.priority,
            ui.description
        ].forEach((field) => {
            field.removeAttribute('aria-invalid');
        });
    }

    function validateForm() {
        clearValidationErrors();

        const validations = [
            {
                field: ui.title,
                errorId: 'title-error',
                message:
                    'Informe um título com pelo menos 4 caracteres.',
                isValid: (value) => value.trim().length >= 4
            },
            {
                field: ui.category,
                errorId: 'category-error',
                message: 'Selecione uma categoria válida.',
                isValid: (value) => CATEGORIES.includes(value)
            },
            {
                field: ui.priority,
                errorId: 'priority-error',
                message: 'Selecione uma prioridade válida.',
                isValid: (value) => PRIORITIES.includes(value)
            },
            {
                field: ui.description,
                errorId: 'description-error',
                message:
                    'Descreva o problema com pelo menos 10 caracteres.',
                isValid: (value) => value.trim().length >= 10
            }
        ];

        let valid = true;

        validations.forEach((validation) => {
            const {
                field,
                errorId,
                message,
                isValid
            } = validation;

            if (!isValid(field.value)) {
                const errorElement =
                    document.getElementById(errorId);

                if (errorElement) {
                    errorElement.textContent = message;
                }

                field.setAttribute('aria-invalid', 'true');
                valid = false;
            }
        });

        if (!valid) {
            const firstInvalid =
                ui.form.querySelector('[aria-invalid="true"]');

            if (firstInvalid) {
                firstInvalid.focus();
            }
        }

        return valid;
    }

    // =========================================================
    // CADASTRO DE CHAMADOS
    // =========================================================

    function createTicket(event) {
        event.preventDefault();

        if (!validateForm()) {
            return;
        }

        const ticket = {
            id: generateTicketId(),
            title: ui.title.value.trim(),
            category: ui.category.value,
            priority: ui.priority.value,
            description: ui.description.value.trim(),
            status: 'Aberto',
            createdAt: new Date().toISOString()
        };

        tickets.unshift(ticket);

        if (!saveTickets()) {
            tickets.shift();
            return;
        }

        ui.form.reset();

        ui.descriptionCounter.textContent = '0/2000';

        clearValidationErrors();

        renderAll();
        navigate('tickets');

        showToast(
            `Chamado ${ticket.id} registrado com sucesso.`
        );
    }

    // =========================================================
    // ATUALIZAÇÃO DE STATUS
    // =========================================================

    function changeTicketStatus(event) {
        const select = event.target.closest(
            '[data-ticket-status]'
        );

        if (!select) {
            return;
        }

        const ticket = tickets.find((item) => {
            return item.id === select.dataset.ticketStatus;
        });

        if (!ticket || !STATUS.includes(select.value)) {
            return;
        }

        const previousStatus = ticket.status;

        ticket.status = select.value;

        if (!saveTickets()) {
            ticket.status = previousStatus;
            renderAll();
            return;
        }

        renderAll();

        showToast(
            `Status atualizado para "${ticket.status}".`
        );
    }

    // =========================================================
    // INICIALIZAÇÃO DOS EVENTOS
    // =========================================================

    function initialize() {
        // Navegação entre as telas.
        document.querySelectorAll('[data-view]').forEach((button) => {
            button.addEventListener('click', () => {
                navigate(button.dataset.view);
            });
        });

        $('#header-new-ticket').addEventListener('click', () => {
            navigate('new-ticket');
        });

        $('#menu-toggle').addEventListener('click', () => {
            ui.sidebar.classList.toggle('open');
        });

        // Cadastro.
        ui.form.addEventListener('submit', createTicket);

        // Contador de caracteres da descrição.
        ui.description.addEventListener('input', () => {
            ui.descriptionCounter.textContent =
                `${ui.description.value.length}/2000`;
        });

        // Limpeza e reset do formulário.
        ui.form.addEventListener('reset', () => {
            window.setTimeout(() => {
                clearValidationErrors();
                ui.descriptionCounter.textContent = '0/2000';
            }, 0);
        });

        $('#cancel-form').addEventListener('click', () => {
            showToast('Formulário limpo.');
        });

        // Filtros.
        [
            ui.search,
            ui.filterStatus,
            ui.filterCategory,
            ui.filterStart,
            ui.filterEnd
        ].forEach((field) => {
            field.addEventListener('input', renderTickets);
            field.addEventListener('change', renderTickets);
        });

        $('#clear-filters').addEventListener(
            'click',
            clearFilters
        );

        // Atualização de status nas duas tabelas.
        ui.recentBody.addEventListener(
            'change',
            changeTicketStatus
        );

        ui.ticketsBody.addEventListener(
            'change',
            changeTicketStatus
        );

        // Data no dashboard.
        $('#today-label').textContent =
            new Intl.DateTimeFormat('pt-BR', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }).format(new Date());

        // Renderização inicial.
        renderAll();
    }

    // Garante que o HTML esteja carregado antes de acessar os elementos.
    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            initialize
        );
    } else {
        initialize();
    }
})();