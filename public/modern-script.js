/**
 * Modern Script for Hackathon Harvester
 * Handles AI-powered search functionality with Google Search + Gemini
 * Includes authentication and public hackathon browsing
 */

class HackathonSearchApp {
    constructor() {
        this.currentTab = 'general';
        this.categories = [];
        this.isAuthenticated = false;
        this.adminCredentials = null;
        this.currentPage = 1;
        this.totalPages = 1;
        this.prizeCounter = 1;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadCategories();
        this.setupQuickActions();
        await this.loadPublicHackathons(); // Load public hackathons on startup
    }

    setupEventListeners() {
        // Authentication
        document.getElementById('login-btn').addEventListener('click', () => this.authenticate());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Search buttons (admin only)
        document.getElementById('search-btn').addEventListener('click', () => this.performGeneralSearch());
        document.getElementById('location-search-btn').addEventListener('click', () => this.performLocationSearch());
        document.getElementById('custom-search-btn').addEventListener('click', () => this.performCustomSearch());

        // Public hackathon filters
        document.getElementById('apply-filters-btn').addEventListener('click', () => this.applyPublicFilters());
        document.getElementById('public-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.applyPublicFilters();
        });

        // Enter key support for admin search
        document.getElementById('general-query').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performGeneralSearch();
        });
        document.getElementById('location-query').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performLocationSearch();
        });
        document.getElementById('custom-query').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performCustomSearch();
        });

        // Admin panel tabs
        document.querySelectorAll('.panel-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchPanelTab(e.target.dataset.panelTab));
        });

        // Admin search
        document.getElementById('admin-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.loadAdminHackathons();
        });

        // Hackathon form submission
        document.getElementById('hackathon-form').addEventListener('submit', (e) => this.handleHackathonFormSubmit(e));
    }

    // Authentication methods
    async authenticate() {
        const adminId = document.getElementById('admin-id').value.trim();
        const adminPassword = document.getElementById('admin-password').value.trim();

        if (!adminId || !adminPassword) {
            this.showAuthStatus('Please enter both admin ID and password', 'error');
            return;
        }

        try {
            // Test authentication with a simple API call
            const response = await fetch(`/api/search/categories?admin_id=${encodeURIComponent(adminId)}&admin_password=${encodeURIComponent(adminPassword)}`);

            if (response.ok) {
                this.isAuthenticated = true;
                this.adminCredentials = { id: adminId, password: adminPassword };
                this.showAuthStatus('✅ Authentication successful! Search functionality unlocked.', 'success');

                // Show admin sections
                document.getElementById('search-section').style.display = 'block';
                document.getElementById('admin-actions').style.display = 'block';
                document.getElementById('admin-panel').style.display = 'block';
                document.getElementById('login-btn').style.display = 'none';
                document.getElementById('logout-btn').style.display = 'inline-block';

                // Load admin data
                this.loadAdminHackathons();
                this.loadApiStatus();

                // Update UI
                document.querySelector('.auth-notice').innerHTML = `
                    <i class="fas fa-check-circle"></i> 
                    <strong>Authenticated as ${adminId}</strong> - Search functionality is now available.
                `;
            } else {
                const error = await response.json();
                this.showAuthStatus(`❌ ${error.message || 'Authentication failed'}`, 'error');
            }
        } catch (error) {
            this.showAuthStatus(`❌ Authentication error: ${error.message}`, 'error');
        }
    }

    logout() {
        this.isAuthenticated = false;
        this.adminCredentials = null;

        // Hide admin sections
        document.getElementById('search-section').style.display = 'none';
        document.getElementById('admin-actions').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
        document.getElementById('login-btn').style.display = 'inline-block';
        document.getElementById('logout-btn').style.display = 'none';

        // Reset auth form
        document.getElementById('admin-id').value = 'admin';
        document.getElementById('admin-password').value = 'admin123';
        this.showAuthStatus('', '');

        // Update UI
        document.querySelector('.auth-notice').innerHTML = `
            <i class="fas fa-lock"></i> 
            <strong>Notice:</strong> Search functionality requires admin authentication. 
            Regular users can browse <a href="#hackathons">stored hackathons</a> below.
        `;
    }

    showAuthStatus(message, type) {
        const statusEl = document.getElementById('auth-status');
        statusEl.textContent = message;
        statusEl.className = `auth-status ${type}`;
    }

    // Public hackathons methods
    async loadPublicHackathons(page = 1) {
        try {
            const search = document.getElementById('public-search')?.value || '';
            const status = document.getElementById('status-filter')?.value || '';
            const mode = document.getElementById('mode-filter')?.value || '';

            const params = new URLSearchParams({
                page: page.toString(),
                limit: '12',
                ...(search && { search }),
                ...(status && { status }),
                ...(mode && { mode })
            });

            const response = await fetch(`/api/hackathons?${params}`);
            const data = await response.json();

            if (data.success !== false) {
                this.displayPublicHackathons(data.hackathons || []);
                this.updatePagination(data.pagination || { page: 1, pages: 1, total: 0 });
                this.updatePaginationInfo(data.pagination || { page: 1, pages: 1, total: 0 });
            } else {
                this.displayPublicHackathons([]);
                console.error('Failed to load public hackathons:', data.message);
            }
        } catch (error) {
            console.error('Error loading public hackathons:', error);
            this.displayPublicHackathons([]);
        }
    }

    async applyPublicFilters() {
        this.currentPage = 1;
        await this.loadPublicHackathons(1);
    }

    displayPublicHackathons(hackathons) {
        const grid = document.getElementById('public-hackathons-grid');

        if (!hackathons || hackathons.length === 0) {
            grid.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <h3>No hackathons found</h3>
                    <p>Try adjusting your filters or check back later for new hackathons.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = hackathons.map(hackathon => this.createHackathonCard(hackathon, false)).join('');
    }

    updatePagination(pagination) {
        const paginationEl = document.getElementById('pagination');
        const { page, pages } = pagination;

        let paginationHTML = '';

        // Previous button
        paginationHTML += `
            <button ${page <= 1 ? 'disabled' : ''} onclick="app.goToPage(${page - 1})">
                <i class="fas fa-chevron-left"></i> Previous
            </button>
        `;

        // Page numbers
        for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) {
            paginationHTML += `
                <button class="${i === page ? 'active' : ''}" onclick="app.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        // Next button
        paginationHTML += `
            <button ${page >= pages ? 'disabled' : ''} onclick="app.goToPage(${page + 1})">
                Next <i class="fas fa-chevron-right"></i>
            </button>
        `;

        paginationEl.innerHTML = paginationHTML;
        this.currentPage = page;
        this.totalPages = pages;
    }

    updatePaginationInfo(pagination) {
        const infoEl = document.getElementById('pagination-info');
        const { page, pages, total } = pagination;
        const start = (page - 1) * 12 + 1;
        const end = Math.min(page * 12, total);

        infoEl.textContent = `Showing ${start}-${end} of ${total} hackathons (Page ${page} of ${pages})`;
    }

    async goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) return;
        await this.loadPublicHackathons(page);
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;
    }

    async loadCategories() {
        try {
            const response = await fetch('/api/search/categories');
            const data = await response.json();

            if (data.success) {
                this.categories = data.categories;
                this.renderCategories();
            }
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    }

    renderCategories() {
        const grid = document.getElementById('category-grid');
        grid.innerHTML = this.categories.map(category => `
            <div class="category-card" onclick="app.searchByCategory('${category.id}')">
                <h4>${category.name}</h4>
                <p>${category.description}</p>
            </div>
        `).join('');
    }

    async performGeneralSearch() {
        if (!this.isAuthenticated) {
            alert('Please log in as admin to use search functionality');
            return;
        }

        const query = document.getElementById('general-query').value.trim();
        if (!query) {
            alert('Please enter a search query');
            return;
        }

        const save = document.getElementById('save-results').checked;
        const url = `/api/search/hackathons?${this.getAuthParams()}&query=${encodeURIComponent(query)}&save=${save}&limit=10`;
        await this.executeSearch(url, 'General Search');
    }

    async performLocationSearch() {
        if (!this.isAuthenticated) {
            alert('Please log in as admin to use search functionality');
            return;
        }

        const location = document.getElementById('location-query').value.trim();
        if (!location) {
            alert('Please enter a location');
            return;
        }

        const url = `/api/search/hackathons?${this.getAuthParams()}&location=${encodeURIComponent(location)}&limit=10`;
        await this.executeSearch(url, `Location: ${location}`);
    }

    async searchByCategory(categoryId) {
        if (!this.isAuthenticated) {
            alert('Please log in as admin to use search functionality');
            return;
        }

        const category = this.categories.find(c => c.id === categoryId);
        const categoryName = category ? category.name : categoryId;

        const url = `/api/search/hackathons?${this.getAuthParams()}&category=${categoryId}&limit=10`;
        await this.executeSearch(url, `Category: ${categoryName}`);
    }

    async performCustomSearch() {
        if (!this.isAuthenticated) {
            alert('Please log in as admin to use search functionality');
            return;
        }

        const query = document.getElementById('custom-query').value.trim();
        const prompt = document.getElementById('custom-prompt').value.trim();

        if (!query) {
            alert('Please enter a search query');
            return;
        }

        if (!prompt) {
            alert('Please enter a custom prompt describing what you want to find');
            return;
        }

        // Use the new admin search endpoint
        const requestBody = {
            query: query,
            prompt: prompt,
            limit: 5,
            save: true
        };

        await this.executeAdminSearch(requestBody);
    }

    getAuthParams() {
        if (!this.adminCredentials) return '';
        return `admin_id=${encodeURIComponent(this.adminCredentials.id)}&admin_password=${encodeURIComponent(this.adminCredentials.password)}`;
    }

    async executeAdminSearch(requestBody) {
        this.showLoading(true);
        this.clearResults();

        try {
            console.log('🎯 Executing admin search with custom prompt:', requestBody);
            const url = `/api/search/admin?${this.getAuthParams()}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (data.success) {
                this.displayResults(data, `Admin Search: ${requestBody.query}`);
            } else {
                this.showError(data.message || 'Admin search failed');
            }
        } catch (error) {
            console.error('Admin search failed:', error);
            this.showError('Network error occurred');
        } finally {
            this.showLoading(false);
        }
    }

    async executeSearch(url, searchType) {
        this.showLoading(true);
        this.clearResults();

        try {
            // console.log(`🔍 Executing search: ${url}`);
            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                this.displayResults(data, searchType);
                document.getElementById('results-section').style.display = 'block';
            } else {
                this.showError(data.message || 'Search failed');
            }
        } catch (error) {
            console.error('Search failed:', error);
            this.showError('Network error occurred');
        } finally {
            this.showLoading(false);
        }
    }

    async executeCustomSearch(requestBody) {
        this.showLoading(true);
        this.clearResults();

        try {
            console.log('🎯 Executing custom search:', requestBody);
            const response = await fetch('/api/search/custom', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (data.success) {
                this.displayResults(data, `Custom Search: ${requestBody.searchQuery}`);
            } else {
                this.showError(data.message || 'Custom search failed');
            }
        } catch (error) {
            console.error('Custom search failed:', error);
            this.showError('Network error occurred');
        } finally {
            this.showLoading(false);
        }
    }

    displayResults(data, searchType) {
        const hackathons = data.data.hackathons;
        const metadata = data.data.metadata;

        // Update results meta
        const metaElement = document.getElementById('results-meta');
        metaElement.innerHTML = `
            <div class="search-info">
                <span class="search-type">${searchType}</span>
                <span class="result-count">${hackathons.length} hackathons found</span>
                ${data.saved ? `<span class="saved-count">💾 ${data.saved.count} saved to database</span>` : ''}
            </div>
            <div class="metadata">
                <small>
                    Query: "${metadata.searchQuery}" | 
                    Extracted: ${new Date(metadata.extractedAt).toLocaleString()}
                    ${metadata.sources ? ` | Sources: ${metadata.sources.length}` : ''}
                </small>
            </div>
        `;

        // Display hackathons
        const grid = document.getElementById('hackathons-grid');
        if (hackathons.length === 0) {
            grid.innerHTML = '<div class="no-results">No hackathons found. Try a different search query.</div>';
            return;
        }

        grid.innerHTML = hackathons.map(hackathon => this.createHackathonCard(hackathon, true)).join('');

        // Show results section
        document.getElementById('results-section').style.display = 'block';
    }

    createHackathonCard(hackathon, isAdminView = false) {
        const statusClass = hackathon.status === 'upcoming' ? 'status-upcoming' :
            hackathon.status === 'ongoing' ? 'status-ongoing' : 'status-completed';

        const formatClass = hackathon.location ?
            (hackathon.location.type === 'Virtual' ? 'format-virtual' :
                hackathon.location.type === 'Hybrid' ? 'format-hybrid' : 'format-inperson') :
            (hackathon.mode === 'Online' ? 'format-virtual' :
                hackathon.mode === 'Hybrid' ? 'format-hybrid' : 'format-inperson');

        // Handle different data structures for admin vs public hackathons
        const title = hackathon.title || hackathon.name;
        const description = hackathon.description;
        const website = hackathon.website;
        const organizer = hackathon.organizer ?
            (typeof hackathon.organizer === 'object' ? hackathon.organizer.name : hackathon.organizer) :
            'Unknown Organizer';
        const location = hackathon.location ?
            (typeof hackathon.location === 'object' ?
                `${hackathon.location.city}, ${hackathon.location.country}` :
                hackathon.location) :
            'Location TBA';
        const startDate = hackathon.startDate;
        const prizes = hackathon.prizes ?
            (typeof hackathon.prizes === 'object' ?
                (hackathon.prizes.totalPool ||
                    (hackathon.prizes.length > 0 ? hackathon.prizes[0].amount : 'TBA')) :
                hackathon.prizes) :
            'Prizes TBA';

        // Ensure themes is an array
        const themes = Array.isArray(hackathon.themes) ? hackathon.themes : [];

        return `
            <div class="hackathon-card">
                <div class="card-header">
                    <h3 class="hackathon-title">${title}</h3>
                    <div class="status-badges">
                        <span class="status-badge ${statusClass}">${hackathon.status}</span>
                        <span class="format-badge ${formatClass}">${hackathon.location?.type || hackathon.mode}</span>
                        ${isAdminView && hackathon.confidence ?
                `<span class="confidence-badge">Confidence: ${Math.round(hackathon.confidence * 100)}%</span>` :
                ''}
                    </div>
                </div>
                
                <div class="card-body">
                    <p class="description">${this.truncateText(description, 150)}</p>
                    
                    <div class="details-grid">
                        <div class="detail-item">
                            <i class="fas fa-calendar"></i>
                            <span>${startDate && startDate !== 'Not available' ?
                new Date(startDate).toLocaleDateString() : 'Date TBA'}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${location}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-building"></i>
                            <span>${organizer}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-trophy"></i>
                            <span>${prizes}</span>
                        </div>
                    </div>

                    ${themes.length > 0 ? `
                        <div class="themes">
                            ${themes.slice(0, 4).map(theme =>
                    `<span class="theme-tag">${theme}</span>`
                ).join('')}
                            ${themes.length > 4 ? `<span class="theme-tag more">+${themes.length - 4}</span>` : ''}
                        </div>
                    ` : ''}
                </div>

                <div class="card-footer">
                    ${website && website !== 'Not available' && !website.includes('example.com') ?
                `<a href="${website}" target="_blank" rel="noopener noreferrer" class="btn-primary">
                            <i class="fas fa-external-link-alt"></i> View Details
                        </a>` :
                '<span class="btn-disabled">Website Not Available</span>'
            }
                    <button onclick="app.showHackathonDetails('${encodeURIComponent(JSON.stringify({ title, description, organizer, location, startDate, website, themes, prizes }))}')" class="btn-secondary">
                        <i class="fas fa-info-circle"></i> More Info
                    </button>
                </div>
            </div>
        `;
    }

    showHackathonDetails(encodedData) {
        try {
            const hackathon = JSON.parse(decodeURIComponent(encodedData));
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>${hackathon.title}</h2>
                        <button onclick="this.closest('.modal-overlay').remove()" class="close-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Description:</strong> ${hackathon.description}</p>
                        <p><strong>Organizer:</strong> ${hackathon.organizer}</p>
                        <p><strong>Location:</strong> ${hackathon.location}</p>
                        <p><strong>Start Date:</strong> ${hackathon.startDate ? new Date(hackathon.startDate).toLocaleDateString() : 'TBA'}</p>
                        ${hackathon.website && hackathon.website !== 'Not available' && !hackathon.website.includes('example.com') ?
                    `<p><strong>Website:</strong> <a href="${hackathon.website}" target="_blank" rel="noopener noreferrer">${hackathon.website}</a></p>` : ''}
                        <p><strong>Prizes:</strong> ${hackathon.prizes}</p>
                        ${Array.isArray(hackathon.themes) && hackathon.themes.length > 0 ?
                    `<p><strong>Themes:</strong> ${hackathon.themes.join(', ')}</p>` : ''}
                    </div>
                    <div class="modal-footer">
                        ${hackathon.website && hackathon.website !== 'Not available' && !hackathon.website.includes('example.com') ?
                    `<a href="${hackathon.website}" target="_blank" rel="noopener noreferrer" class="btn-primary">
                                <i class="fas fa-external-link-alt"></i> Visit Official Website
                            </a>` : ''}
                        <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } catch (error) {
            console.error('Error showing hackathon details:', error);
            alert('Error loading hackathon details');
        }
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength) + '...';
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        loading.style.display = show ? 'flex' : 'none';
    }

    clearResults() {
        document.getElementById('hackathons-grid').innerHTML = '';
        document.getElementById('results-meta').innerHTML = '';
        document.getElementById('results-section').style.display = 'none';
    }

    showError(message) {
        const grid = document.getElementById('hackathons-grid');
        grid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Search Error</h3>
                <p>${message}</p>
                <button onclick="location.reload()" class="btn-primary">Try Again</button>
            </div>
        `;
        document.getElementById('results-section').style.display = 'block';
    }

    // ==================== ADMIN PANEL METHODS ====================

    switchPanelTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.panel-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-panel-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.panel-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-panel`).classList.add('active');

        // Load tab-specific data
        if (tabName === 'manage-hackathons') {
            this.loadAdminHackathons();
        } else if (tabName === 'api-status') {
            this.loadApiStatus();
        } else if (tabName === 'auto-fetch') {
            this.loadAutoFetchStatus();
        }
    }

    async loadAdminHackathons(page = 1) {
        if (!this.isAuthenticated) return;

        try {
            this.showAdminLoading(true);

            const search = document.getElementById('admin-search')?.value || '';
            const status = document.getElementById('admin-status-filter')?.value || '';

            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                ...(search && { search }),
                ...(status && { status })
            });

            const response = await fetch(`/api/admin/hackathons?${params}&${this.getAuthParams()}`);
            const data = await response.json();

            if (data.success) {
                this.displayAdminHackathons(data.data);
                this.updateAdminPagination(data.pagination);
            } else {
                this.showAdminError('Failed to load hackathons: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error loading admin hackathons:', error);
            this.showAdminError('Network error occurred');
        } finally {
            this.showAdminLoading(false);
        }
    }

    displayAdminHackathons(hackathons) {
        const grid = document.getElementById('admin-hackathons-grid');

        if (!hackathons || hackathons.length === 0) {
            grid.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <h3>No hackathons found</h3>
                    <p>Try adjusting your search criteria.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = hackathons.map(hackathon => `
            <div class="admin-hackathon-card">
                <div class="card-header">
                    <h4>${hackathon.name}</h4>
                    <div class="card-actions">
                        <button onclick="app.viewHackathonDetails(${JSON.stringify(hackathon).replace(/"/g, '&quot;')})" class="btn-view" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="app.showEditHackathonForm('${hackathon._id}')" class="btn-edit" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="app.deleteHackathon('${hackathon._id}', '${hackathon.name}')" class="btn-delete" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <p><strong>Website:</strong> <a href="${hackathon.website}" target="_blank" rel="noopener noreferrer">${hackathon.website}</a></p>
                    <p><strong>Organizer:</strong> ${hackathon.organizer}</p>
                    <p><strong>Start Date:</strong> ${new Date(hackathon.startDate).toLocaleDateString()}</p>
                    <p><strong>Status:</strong> <span class="status-${hackathon.status}">${hackathon.status}</span></p>
                    <p><strong>Location:</strong> ${hackathon.location} (${hackathon.mode})</p>
                    ${hackathon.themes && hackathon.themes.length > 0 ?
                `<p><strong>Themes:</strong> ${hackathon.themes.join(', ')}</p>` : ''}
                </div>
            </div>
        `).join('');
    }

    async loadApiStatus() {
        if (!this.isAuthenticated) return;

        try {
            const response = await fetch(`/api/admin/api-usage?${this.getAuthParams()}`);
            const data = await response.json();

            if (data.success) {
                this.displayApiStatus(data.data);
            } else {
                this.showApiStatusError('Failed to load API status');
            }
        } catch (error) {
            console.error('Error loading API status:', error);
            this.showApiStatusError('Network error occurred');
        }
    }

    displayApiStatus(apiData) {
        const grid = document.getElementById('api-status-grid');
        const percentage = (apiData.currentUsage / apiData.dailyLimit) * 100;
        const resetTime = new Date(apiData.resetTime).toLocaleString();

        grid.innerHTML = `
            <div class="status-card">
                <h4><i class="fas fa-chart-bar"></i> API Usage Today</h4>
                <div class="usage-bar">
                    <div class="usage-fill" style="width: ${percentage}%"></div>
                </div>
                <p><strong>${apiData.currentUsage}</strong> / ${apiData.dailyLimit} calls used (${percentage.toFixed(1)}%)</p>
                <p><strong>Remaining:</strong> ${apiData.remaining} calls</p>
                <p><strong>Resets:</strong> ${resetTime}</p>
                <p><strong>Status:</strong> 
                    <span class="${apiData.canMakeRequest ? 'status-good' : 'status-warning'}">
                        ${apiData.canMakeRequest ? 'Available' : 'Limit Reached'}
                    </span>
                </p>
            </div>
            <div class="status-card">
                <h4><i class="fas fa-robot"></i> Auto-Fetch Statistics</h4>
                <p><strong>Total Runs:</strong> ${apiData.autoFetchRuns || 0}</p>
                <p><strong>Last Run:</strong> ${apiData.lastAutoFetch ?
                new Date(apiData.lastAutoFetch).toLocaleString() : 'Never'}</p>
                <p><strong>Next Run:</strong> Every 6 hours</p>
            </div>
        `;
    }

    async triggerAutoFetch() {
        if (!this.isAuthenticated) return;

        try {
            const response = await fetch(`/api/admin/trigger-auto-fetch?${this.getAuthParams()}`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.success) {
                alert('Auto-fetch triggered successfully! Check back in a few minutes for results.');
                this.loadApiStatus(); // Refresh API status
            } else {
                alert('Failed to trigger auto-fetch: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error triggering auto-fetch:', error);
            alert('Network error occurred');
        }
    }

    async showCreateHackathonForm() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content large">
                <div class="modal-header">
                    <h2>Add New Hackathon</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="create-hackathon-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Name *</label>
                                <input type="text" name="name" required>
                            </div>
                            <div class="form-group">
                                <label>Website *</label>
                                <input type="url" name="website" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea name="description" rows="3"></textarea>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Start Date *</label>
                                <input type="date" name="startDate" required>
                            </div>
                            <div class="form-group">
                                <label>End Date</label>
                                <input type="date" name="endDate">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Location</label>
                                <input type="text" name="location" placeholder="City, Country or Online">
                            </div>
                            <div class="form-group">
                                <label>Mode</label>
                                <select name="mode">
                                    <option value="Online">Online</option>
                                    <option value="Offline">Offline</option>
                                    <option value="Hybrid">Hybrid</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Organizer</label>
                            <input type="text" name="organizer">
                        </div>
                        <div class="form-group">
                            <label>Themes (comma-separated)</label>
                            <input type="text" name="themes" placeholder="AI, ML, Web Development">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button onclick="app.saveNewHackathon()" class="btn-primary">
                        <i class="fas fa-save"></i> Save Hackathon
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    async saveNewHackathon() {
        if (!this.isAuthenticated) return;

        try {
            const form = document.getElementById('create-hackathon-form');
            const formData = new FormData(form);
            const hackathonData = Object.fromEntries(formData.entries());

            // Parse themes
            if (hackathonData.themes) {
                hackathonData.themes = hackathonData.themes.split(',').map(t => t.trim()).filter(t => t);
            }

            const response = await fetch(`/api/admin/hackathons?${this.getAuthParams()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(hackathonData)
            });

            const data = await response.json();

            if (data.success) {
                alert('Hackathon created successfully!');
                document.querySelector('.modal-overlay').remove();
                this.loadAdminHackathons(); // Refresh the list
            } else {
                alert('Failed to create hackathon: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error creating hackathon:', error);
            alert('Network error occurred');
        }
    }

    async editHackathon(hackathonId) {
        // Implement edit functionality (similar to create but with pre-populated data)
        alert('Edit functionality coming soon!');
    }

    async deleteHackathon(hackathonId, hackathonName) {
        if (!this.isAuthenticated) return;

        if (!confirm(`Are you sure you want to delete "${hackathonName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/hackathons/${hackathonId}?${this.getAuthParams()}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                alert('Hackathon deleted successfully!');
                this.loadAdminHackathons(); // Refresh the list
            } else {
                alert('Failed to delete hackathon: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error deleting hackathon:', error);
            alert('Network error occurred');
        }
    }

    showAdminLoading(show) {
        const loading = document.getElementById('admin-loading');
        loading.style.display = show ? 'block' : 'none';
    }

    showAdminError(message) {
        const grid = document.getElementById('admin-hackathons-grid');
        grid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
            </div>
        `;
    }

    showApiStatusError(message) {
        const grid = document.getElementById('api-status-grid');
        grid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
            </div>
        `;
    }

    updateAdminPagination(pagination) {
        const paginationEl = document.getElementById('admin-pagination');
        if (!pagination) return;

        const { currentPage, totalPages } = pagination;
        let paginationHTML = '';

        if (totalPages > 1) {
            paginationHTML += `
                <button ${currentPage <= 1 ? 'disabled' : ''} onclick="app.loadAdminHackathons(${currentPage - 1})">
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
            `;

            for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
                paginationHTML += `
                    <button class="${i === currentPage ? 'active' : ''}" onclick="app.loadAdminHackathons(${i})">
                        ${i}
                    </button>
                `;
            }

            paginationHTML += `
                <button ${currentPage >= totalPages ? 'disabled' : ''} onclick="app.loadAdminHackathons(${currentPage + 1})">
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            `;
        }

        paginationEl.innerHTML = paginationHTML;
    }

    // ==================== HACKATHON EDIT FUNCTIONALITY ====================

    /**
     * Show the create hackathon form
     */
    showCreateHackathonForm() {
        this.resetHackathonForm();
        document.getElementById('modal-title').textContent = 'Add New Hackathon';
        document.getElementById('submit-btn-text').textContent = 'Create Hackathon';
        document.getElementById('hackathon-modal').style.display = 'flex';
        this.prizeCounter = 1; // Reset prize counter
    }

    /**
     * Show the edit hackathon form
     */
    async showEditHackathonForm(hackathonId) {
        try {
            // Fetch hackathon details
            const response = await fetch(`/api/admin/hackathons/${hackathonId}`);
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch hackathon');
            }

            const hackathon = result.data;

            // Populate form
            document.getElementById('hackathon-id').value = hackathon._id;
            document.getElementById('hackathon-name').value = hackathon.name || '';
            document.getElementById('hackathon-description').value = hackathon.description || '';
            document.getElementById('hackathon-website').value = hackathon.website || '';
            document.getElementById('hackathon-organizer').value = hackathon.organizer || '';

            // Format dates for datetime-local input
            if (hackathon.startDate) {
                document.getElementById('hackathon-start-date').value = this.formatDateForInput(hackathon.startDate);
            }
            if (hackathon.endDate) {
                document.getElementById('hackathon-end-date').value = this.formatDateForInput(hackathon.endDate);
            }
            if (hackathon.registrationDeadline) {
                document.getElementById('hackathon-registration-deadline').value = this.formatDateForInput(hackathon.registrationDeadline);
            }

            document.getElementById('hackathon-status').value = hackathon.status || 'upcoming';
            document.getElementById('hackathon-mode').value = hackathon.mode || 'Online';
            document.getElementById('hackathon-location').value = hackathon.location || '';
            document.getElementById('hackathon-themes').value = hackathon.themes ? hackathon.themes.join(', ') : '';
            document.getElementById('hackathon-eligibility').value = hackathon.eligibility || '';
            document.getElementById('hackathon-contact-email').value = hackathon.contactInfo?.email || '';
            document.getElementById('hackathon-registration-link').value = hackathon.registrationLink || '';

            // Populate prizes
            this.populatePrizes(hackathon.prizes || []);

            // Update modal title
            document.getElementById('modal-title').textContent = 'Edit Hackathon';
            document.getElementById('submit-btn-text').textContent = 'Update Hackathon';
            document.getElementById('hackathon-modal').style.display = 'flex';

        } catch (error) {
            console.error('Error loading hackathon for edit:', error);
            alert('Failed to load hackathon details: ' + error.message);
        }
    }

    /**
     * Close the hackathon modal
     */
    closeHackathonModal() {
        document.getElementById('hackathon-modal').style.display = 'none';
        this.resetHackathonForm();
    }

    /**
     * Reset the hackathon form
     */
    resetHackathonForm() {
        document.getElementById('hackathon-form').reset();
        document.getElementById('hackathon-id').value = '';
        this.resetPrizes();
    }

    /**
     * Format date for datetime-local input
     */
    formatDateForInput(dateString) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    /**
     * Initialize prize management
     */
    resetPrizes() {
        const container = document.getElementById('prizes-container');
        container.innerHTML = `
            <div class="prize-entry" data-index="0">
                <div class="prize-fields">
                    <input type="text" placeholder="Position (e.g., 1st Place)" name="prize-position-0">
                    <input type="text" placeholder="Amount (e.g., $5,000)" name="prize-amount-0">
                    <input type="text" placeholder="Description" name="prize-description-0">
                    <button type="button" onclick="app.removePrize(0)" class="btn-danger btn-small">Remove</button>
                </div>
            </div>
        `;
        this.prizeCounter = 1;
    }

    /**
     * Populate existing prizes
     */
    populatePrizes(prizes) {
        const container = document.getElementById('prizes-container');
        container.innerHTML = '';

        if (prizes.length === 0) {
            this.resetPrizes();
            return;
        }

        prizes.forEach((prize, index) => {
            const prizeHTML = `
                <div class="prize-entry" data-index="${index}">
                    <div class="prize-fields">
                        <input type="text" placeholder="Position (e.g., 1st Place)" name="prize-position-${index}" value="${prize.position || ''}">
                        <input type="text" placeholder="Amount (e.g., $5,000)" name="prize-amount-${index}" value="${prize.amount || ''}">
                        <input type="text" placeholder="Description" name="prize-description-${index}" value="${prize.description || ''}">
                        <button type="button" onclick="app.removePrize(${index})" class="btn-danger btn-small">Remove</button>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', prizeHTML);
        });

        this.prizeCounter = prizes.length;
    }

    /**
     * Add a new prize field
     */
    addPrize() {
        const container = document.getElementById('prizes-container');
        const prizeHTML = `
            <div class="prize-entry" data-index="${this.prizeCounter}">
                <div class="prize-fields">
                    <input type="text" placeholder="Position (e.g., 1st Place)" name="prize-position-${this.prizeCounter}">
                    <input type="text" placeholder="Amount (e.g., $5,000)" name="prize-amount-${this.prizeCounter}">
                    <input type="text" placeholder="Description" name="prize-description-${this.prizeCounter}">
                    <button type="button" onclick="app.removePrize(${this.prizeCounter})" class="btn-danger btn-small">Remove</button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', prizeHTML);
        this.prizeCounter++;
    }

    /**
     * Remove a prize field
     */
    removePrize(index) {
        const prizeEntry = document.querySelector(`[data-index="${index}"]`);
        if (prizeEntry) {
            prizeEntry.remove();
        }

        // Ensure at least one prize field exists
        const container = document.getElementById('prizes-container');
        if (container.children.length === 0) {
            this.addPrize();
        }
    }

    /**
     * Handle hackathon form submission
     */
    async handleHackathonFormSubmit(event) {
        event.preventDefault();

        const form = document.getElementById('hackathon-form');
        const formData = new FormData(form);
        const hackathonId = formData.get('id');
        const isEdit = !!hackathonId;

        // Build hackathon data object
        const hackathonData = {
            name: formData.get('name'),
            description: formData.get('description'),
            website: formData.get('website'),
            organizer: formData.get('organizer'),
            startDate: formData.get('startDate'),
            endDate: formData.get('endDate'),
            registrationDeadline: formData.get('registrationDeadline') || null,
            status: formData.get('status'),
            mode: formData.get('mode'),
            location: formData.get('location'),
            themes: formData.get('themes') ? formData.get('themes').split(',').map(t => t.trim()).filter(t => t) : [],
            eligibility: formData.get('eligibility'),
            registrationLink: formData.get('registrationLink'),
            contactInfo: {
                email: formData.get('contactEmail') || '',
                phone: '',
                social: {}
            }
        };

        // Collect prizes
        const prizes = [];
        const container = document.getElementById('prizes-container');
        const prizeEntries = container.querySelectorAll('.prize-entry');

        prizeEntries.forEach(entry => {
            const index = entry.dataset.index;
            const position = formData.get(`prize-position-${index}`)?.trim();
            const amount = formData.get(`prize-amount-${index}`)?.trim();
            const description = formData.get(`prize-description-${index}`)?.trim();

            if (position || amount || description) {
                prizes.push({
                    position: position || '',
                    amount: amount || '',
                    description: description || ''
                });
            }
        });

        hackathonData.prizes = prizes;

        try {
            // Add loading state
            form.classList.add('form-loading');

            const url = isEdit ? `/api/admin/hackathons/${hackathonId}` : '/api/admin/hackathons';
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(hackathonData)
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to save hackathon');
            }

            // Success
            alert(`Hackathon ${isEdit ? 'updated' : 'created'} successfully!`);
            this.closeHackathonModal();
            this.loadAdminHackathons(); // Refresh the list

        } catch (error) {
            console.error('Error saving hackathon:', error);
            alert('Failed to save hackathon: ' + error.message);
        } finally {
            form.classList.remove('form-loading');
        }
    }

    /**
     * Delete a hackathon
     */
    async deleteHackathon(hackathonId, hackathonName) {
        if (!confirm(`Are you sure you want to delete "${hackathonName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/hackathons/${hackathonId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to delete hackathon');
            }

            alert('Hackathon deleted successfully!');
            this.loadAdminHackathons(); // Refresh the list

        } catch (error) {
            console.error('Error deleting hackathon:', error);
            alert('Failed to delete hackathon: ' + error.message);
        }
    }

    /**
     * View hackathon details in a modal or new tab
     */
    viewHackathonDetails(hackathon) {
        // Open in new tab/window
        const detailsWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
        detailsWindow.document.write(`
            <html>
                <head>
                    <title>${hackathon.name}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
                        .header { background: #4285f4; color: white; padding: 20px; margin: -20px -20px 20px -20px; }
                        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
                        .label { font-weight: bold; color: #333; }
                        .badges { display: flex; gap: 10px; flex-wrap: wrap; margin: 10px 0; }
                        .badge { padding: 5px 10px; border-radius: 15px; font-size: 12px; font-weight: bold; }
                        .status-upcoming { background: #e8f5e8; color: #2e7d32; }
                        .status-ongoing { background: #fff3e0; color: #f57c00; }
                        .status-completed { background: #f5f5f5; color: #666; }
                        .mode-online { background: #e3f2fd; color: #1976d2; }
                        .mode-offline { background: #e8f5e8; color: #2e7d32; }
                        .mode-hybrid { background: #f3e5f5; color: #7b1fa2; }
                        .prizes { display: grid; gap: 10px; }
                        .prize { background: #f9f9f9; padding: 10px; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${hackathon.name}</h1>
                        <p>Organized by: ${hackathon.organizer}</p>
                    </div>
                    
                    <div class="badges">
                        <span class="badge status-${hackathon.status}">${hackathon.status.toUpperCase()}</span>
                        <span class="badge mode-${hackathon.mode.toLowerCase()}">${hackathon.mode}</span>
                    </div>
                    
                    <div class="section">
                        <h3>Description</h3>
                        <p>${hackathon.description || 'No description available'}</p>
                    </div>
                    
                    <div class="section">
                        <h3>Event Details</h3>
                        <p><span class="label">Start Date:</span> ${new Date(hackathon.startDate).toLocaleString()}</p>
                        <p><span class="label">End Date:</span> ${new Date(hackathon.endDate).toLocaleString()}</p>
                        ${hackathon.registrationDeadline ? `<p><span class="label">Registration Deadline:</span> ${new Date(hackathon.registrationDeadline).toLocaleString()}</p>` : ''}
                        <p><span class="label">Location:</span> ${hackathon.location}</p>
                        <p><span class="label">Website:</span> <a href="${hackathon.website}" target="_blank">${hackathon.website}</a></p>
                        ${hackathon.registrationLink ? `<p><span class="label">Registration:</span> <a href="${hackathon.registrationLink}" target="_blank">Register Here</a></p>` : ''}
                    </div>
                    
                    ${hackathon.themes && hackathon.themes.length > 0 ? `
                    <div class="section">
                        <h3>Themes</h3>
                        <p>${hackathon.themes.join(', ')}</p>
                    </div>
                    ` : ''}
                    
                    ${hackathon.prizes && hackathon.prizes.length > 0 ? `
                    <div class="section">
                        <h3>Prizes</h3>
                        <div class="prizes">
                            ${hackathon.prizes.map(prize => `
                                <div class="prize">
                                    <strong>${prize.position}:</strong> ${prize.amount}<br>
                                    <em>${prize.description}</em>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${hackathon.eligibility ? `
                    <div class="section">
                        <h3>Eligibility</h3>
                        <p>${hackathon.eligibility}</p>
                    </div>
                    ` : ''}
                    
                    ${hackathon.contactInfo?.email ? `
                    <div class="section">
                        <h3>Contact</h3>
                        <p><span class="label">Email:</span> <a href="mailto:${hackathon.contactInfo.email}">${hackathon.contactInfo.email}</a></p>
                    </div>
                    ` : ''}
                    
                    <button onclick="window.close()" style="margin: 20px 0; padding: 10px 20px; background: #4285f4; color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button>
                </body>
            </html>
        `);
    }

    setupQuickActions() {
        // Quick action functions are defined globally below
    }
}

// Quick Action Functions
async function searchPopularCategories() {
    await app.executeSearch('/api/search/hackathons?query=popular hackathons 2024 2025 high participation', 'Popular Hackathons');
}

async function searchStudentHackathons() {
    await app.searchByCategory('student');
}

async function searchVirtualHackathons() {
    await app.executeSearch('/api/search/hackathons?query=virtual online hackathons 2024 2025', 'Virtual Events');
}

async function searchHighPrize() {
    const requestBody = {
        searchQuery: "high prize hackathons 2024 2025",
        filters: { minPrize: 10000 },
        save: true,
        maxResults: 15
    };
    await app.executeCustomSearch(requestBody);
}

async function viewTrends() {
    try {
        const response = await fetch('/api/search/trends');
        const data = await response.json();

        if (data.success && data.analysis) {
            // Show trends in a simple format (in a real app, you'd create a proper modal)
            const trendsWindow = window.open('', '_blank', 'width=800,height=600');
            trendsWindow.document.write(`
                <html>
                    <head><title>Hackathon Trends</title></head>
                    <body style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2>🔍 Hackathon Trends Analysis</h2>
                        <p><strong>Data Points:</strong> ${data.dataPoints} hackathons from last ${data.periodDays} days</p>
                        <div style="white-space: pre-wrap; line-height: 1.6;">${data.analysis}</div>
                        <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px;">Close</button>
                    </body>
                </html>
            `);
        } else {
            alert('No trend data available. Search for some hackathons first!');
        }
    } catch (error) {
        alert('Failed to fetch trends: ' + error.message);
    }
}

// Initialize the app
const app = new HackathonSearchApp();
