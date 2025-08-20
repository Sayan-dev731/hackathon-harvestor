// Global state
let currentPage = 1;
let currentFilters = {};
let hackathons = [];
let websites = [];

// Initialize app
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

async function initializeApp() {
    await loadHackathons();
    await loadStats();
    setupEventListeners();
    showToast('Welcome to Hackathon Hub!', 'success');
}

// Event Listeners
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', debounce(applyFilters, 300));

    // Filter changes
    document.getElementById('status-filter').addEventListener('change', applyFilters);
    document.getElementById('mode-filter').addEventListener('change', applyFilters);
    document.getElementById('start-date-filter').addEventListener('change', applyFilters);
    document.getElementById('end-date-filter').addEventListener('change', applyFilters);
    document.getElementById('sort-filter').addEventListener('change', applyFilters);

    // Admin form
    document.getElementById('add-website-form').addEventListener('submit', handleAddWebsite);

    // Extract URL form
    document.getElementById('extract-url-form').addEventListener('submit', handleExtractAndSave);

    // Modal close
    window.addEventListener('click', function (event) {
        const modal = document.getElementById('hackathon-modal');
        if (event.target === modal) {
            closeModal();
        }
    });
}

// Navigation
function showHome() {
    document.getElementById('home-section').classList.add('active');
    document.getElementById('admin-section').classList.remove('active');

    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelector('.nav-link[onclick="showHome()"]').classList.add('active');

    loadHackathons();
}

function showAdmin() {
    document.getElementById('home-section').classList.remove('active');
    document.getElementById('admin-section').classList.add('active');

    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelector('.nav-link[onclick="showAdmin()"]').classList.add('active');

    loadWebsites();
    loadApiUsage();
}

// Filters
function toggleFilters() {
    const filterPanel = document.getElementById('filter-panel');
    filterPanel.classList.toggle('active');
}

function applyFilters() {
    const filters = {
        search: document.getElementById('search-input').value,
        status: document.getElementById('status-filter').value,
        mode: document.getElementById('mode-filter').value,
        startDate: document.getElementById('start-date-filter').value,
        endDate: document.getElementById('end-date-filter').value,
        sortBy: document.getElementById('sort-filter').value.split('-')[0],
        sortOrder: document.getElementById('sort-filter').value.split('-')[1]
    };

    currentFilters = filters;
    currentPage = 1;
    loadHackathons();
}

function clearFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('status-filter').value = 'all';
    document.getElementById('mode-filter').value = 'all';
    document.getElementById('start-date-filter').value = '';
    document.getElementById('end-date-filter').value = '';
    document.getElementById('sort-filter').value = 'startDate-asc';

    currentFilters = {};
    currentPage = 1;
    loadHackathons();
}

// API Calls
async function loadHackathons() {
    showLoading();

    try {
        const params = new URLSearchParams({
            page: currentPage,
            limit: 12,
            ...currentFilters
        });

        const response = await fetch(`/api/hackathons?${params}`);
        const data = await response.json();

        if (response.ok) {
            hackathons = data.hackathons;
            renderHackathons(data.hackathons);
            renderPagination(data.pagination);
            updateHackathonCount(data.pagination.total);
        } else {
            showToast('Failed to load hackathons', 'error');
        }
    } catch (error) {
        console.error('Error loading hackathons:', error);
        showToast('Error loading hackathons', 'error');
    } finally {
        hideLoading();
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/hackathons/stats/overview');
        const stats = await response.json();

        if (response.ok) {
            document.getElementById('total-hackathons').textContent = stats.total;
            document.getElementById('upcoming-hackathons').textContent = stats.upcoming;
            document.getElementById('ongoing-hackathons').textContent = stats.ongoing;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadHackathonDetails(id) {
    try {
        const response = await fetch(`/api/hackathons/${id}`);
        const hackathon = await response.json();

        if (response.ok) {
            showHackathonModal(hackathon);
        } else {
            showToast('Failed to load hackathon details', 'error');
        }
    } catch (error) {
        console.error('Error loading hackathon details:', error);
        showToast('Error loading hackathon details', 'error');
    }
}

async function loadWebsites() {
    try {
        const response = await fetch('/api/admin/websites');
        const data = await response.json();

        if (response.ok) {
            websites = data;
            renderWebsites(data);
        } else {
            showToast('Failed to load websites', 'error');
        }
    } catch (error) {
        console.error('Error loading websites:', error);
        showToast('Error loading websites', 'error');
    }
}

async function loadApiUsage() {
    try {
        const response = await fetch('/api/admin/api-usage');
        const usage = await response.json();

        if (response.ok) {
            document.getElementById('api-usage').textContent = `${usage.usagePercentage}%`;
            document.getElementById('remaining-requests').textContent = usage.remainingRequests;
        }
    } catch (error) {
        console.error('Error loading API usage:', error);
    }
}

// Rendering Functions
function renderHackathons(hackathons) {
    const grid = document.getElementById('hackathons-grid');

    if (hackathons.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: white;">
                <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <h3>No hackathons found</h3>
                <p>Try adjusting your filters or search terms</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = hackathons.map(hackathon => `
        <div class="hackathon-card" onclick="loadHackathonDetails('${hackathon._id}')">
            <div class="hackathon-header">
                <div>
                    <h3 class="hackathon-title">${hackathon.name}</h3>
                    <div class="hackathon-dates">
                        <i class="fas fa-calendar"></i>
                        <span>${formatDateRange(hackathon.startDate, hackathon.endDate)}</span>
                    </div>
                </div>
                <span class="hackathon-status status-${hackathon.status}">${hackathon.status}</span>
            </div>
            
            <p class="hackathon-description">${hackathon.description || 'No description available'}</p>
            
            ${hackathon.themes && hackathon.themes.length > 0 ? `
                <div class="hackathon-themes">
                    ${hackathon.themes.slice(0, 3).map(theme => `
                        <span class="theme-tag">${theme}</span>
                    `).join('')}
                    ${hackathon.themes.length > 3 ? '<span class="theme-tag">+' + (hackathon.themes.length - 3) + ' more</span>' : ''}
                </div>
            ` : ''}
            
            <div class="hackathon-meta">
                <div class="hackathon-mode">
                    <i class="fas fa-${hackathon.mode === 'Online' ? 'globe' : hackathon.mode === 'Offline' ? 'map-marker-alt' : 'laptop-house'}"></i>
                    <span>${hackathon.mode}</span>
                </div>
                <div class="hackathon-location">${hackathon.location}</div>
            </div>
        </div>
    `).join('');
}

function renderPagination(pagination) {
    const paginationDiv = document.getElementById('pagination');

    if (pagination.pages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }

    let html = '';

    // Previous button
    html += `<button onclick="changePage(${pagination.current - 1})" ${pagination.current === 1 ? 'disabled' : ''}>
        <i class="fas fa-chevron-left"></i>
    </button>`;

    // Page numbers
    const startPage = Math.max(1, pagination.current - 2);
    const endPage = Math.min(pagination.pages, pagination.current + 2);

    if (startPage > 1) {
        html += `<button onclick="changePage(1)">1</button>`;
        if (startPage > 2) {
            html += `<span>...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button onclick="changePage(${i})" ${i === pagination.current ? 'class="active"' : ''}>${i}</button>`;
    }

    if (endPage < pagination.pages) {
        if (endPage < pagination.pages - 1) {
            html += `<span>...</span>`;
        }
        html += `<button onclick="changePage(${pagination.pages})">${pagination.pages}</button>`;
    }

    // Next button
    html += `<button onclick="changePage(${pagination.current + 1})" ${pagination.current === pagination.pages ? 'disabled' : ''}>
        <i class="fas fa-chevron-right"></i>
    </button>`;

    paginationDiv.innerHTML = html;
}

function renderWebsites(websites) {
    const list = document.getElementById('websites-list');

    if (websites.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666;">
                <i class="fas fa-globe" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <h4>No websites configured</h4>
                <p>Add your first website to start scraping hackathon data</p>
            </div>
        `;
        return;
    }

    list.innerHTML = websites.map(website => `
        <div class="website-item">
            <div class="website-header">
                <div class="website-info">
                    <h4>${website.name}</h4>
                    <p><a href="${website.url}" target="_blank">${website.url}</a></p>
                    <div class="website-dates">
                        <span><strong>Start:</strong> ${formatDate(website.startDate)}</span>
                        <span><strong>End:</strong> ${formatDate(website.endDate)}</span>
                        ${website.lastScraped ? `<span><strong>Last Scraped:</strong> ${formatDate(website.lastScraped)}</span>` : ''}
                    </div>
                    <div class="website-status">
                        <span class="status-indicator ${website.isActive ? 'status-active' : 'status-inactive'}"></span>
                        <span>${website.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                </div>
                <div class="website-actions">
                    <button class="btn btn-primary" onclick="scrapeWebsite('${website._id}')">
                        <i class="fas fa-sync"></i> Scrape
                    </button>
                    <button class="btn btn-secondary" onclick="editWebsite('${website._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger" onclick="deleteWebsite('${website._id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
            ${website.notes ? `<p><strong>Notes:</strong> ${website.notes}</p>` : ''}
        </div>
    `).join('');
}

// Modal Functions
function showHackathonModal(hackathon) {
    const modal = document.getElementById('hackathon-modal');
    const modalBody = document.getElementById('modal-body');

    modalBody.innerHTML = `
        <div class="modal-header">
            <h2 class="modal-title">${hackathon.name}</h2>
            <div class="modal-meta">
                <span><i class="fas fa-calendar"></i> ${formatDateRange(hackathon.startDate, hackathon.endDate)}</span>
                <span><i class="fas fa-map-marker-alt"></i> ${hackathon.location}</span>
                <span><i class="fas fa-${hackathon.mode === 'Online' ? 'globe' : 'map-marker-alt'}"></i> ${hackathon.mode}</span>
                <span class="hackathon-status status-${hackathon.status}">${hackathon.status}</span>
            </div>
        </div>
        
        ${hackathon.description ? `
            <div class="modal-section">
                <h4>Description</h4>
                <p>${hackathon.description}</p>
            </div>
        ` : ''}
        
        ${hackathon.themes && hackathon.themes.length > 0 ? `
            <div class="modal-section">
                <h4>Themes</h4>
                <div class="modal-themes">
                    ${hackathon.themes.map(theme => `<span class="theme-tag">${theme}</span>`).join('')}
                </div>
            </div>
        ` : ''}
        
        ${hackathon.prizes && hackathon.prizes.length > 0 ? `
            <div class="modal-section">
                <h4>Prizes</h4>
                <div class="prize-list">
                    ${hackathon.prizes.map(prize => `
                        <div class="prize-item">
                            <strong>${prize.position}:</strong> ${prize.amount}
                            ${prize.description ? `<br><small>${prize.description}</small>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        
        ${hackathon.eligibility ? `
            <div class="modal-section">
                <h4>Eligibility</h4>
                <p>${hackathon.eligibility}</p>
            </div>
        ` : ''}
        
        ${hackathon.organizer ? `
            <div class="modal-section">
                <h4>Organizer</h4>
                <p>${hackathon.organizer}</p>
            </div>
        ` : ''}
        
        ${hackathon.contactInfo && (hackathon.contactInfo.email || hackathon.contactInfo.phone) ? `
            <div class="modal-section">
                <h4>Contact Information</h4>
                <div class="contact-info">
                    ${hackathon.contactInfo.email ? `
                        <div class="contact-item">
                            <i class="fas fa-envelope"></i>
                            <a href="mailto:${hackathon.contactInfo.email}">${hackathon.contactInfo.email}</a>
                        </div>
                    ` : ''}
                    ${hackathon.contactInfo.phone ? `
                        <div class="contact-item">
                            <i class="fas fa-phone"></i>
                            <a href="tel:${hackathon.contactInfo.phone}">${hackathon.contactInfo.phone}</a>
                        </div>
                    ` : ''}
                </div>
            </div>
        ` : ''}
        
        <div class="modal-section">
            <h4>Links</h4>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <a href="${hackathon.website}" target="_blank" class="btn btn-primary">
                    <i class="fas fa-external-link-alt"></i> Website
                </a>
                ${hackathon.registrationLink ? `
                    <a href="${hackathon.registrationLink}" target="_blank" class="btn btn-success">
                        <i class="fas fa-user-plus"></i> Register
                    </a>
                ` : ''}
            </div>
        </div>
    `;

    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('hackathon-modal').style.display = 'none';
}

// Admin Functions
async function handleAddWebsite(event) {
    event.preventDefault();

    const formData = {
        name: document.getElementById('website-name').value,
        url: document.getElementById('website-url').value,
        startDate: document.getElementById('website-start-date').value,
        endDate: document.getElementById('website-end-date').value,
        notes: document.getElementById('website-notes').value
    };

    try {
        const response = await fetch('/api/admin/websites', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok) {
            showToast('Website added successfully!', 'success');
            document.getElementById('add-website-form').reset();
            loadWebsites();
        } else {
            showToast(result.error || 'Failed to add website', 'error');
        }
    } catch (error) {
        console.error('Error adding website:', error);
        showToast('Error adding website', 'error');
    }
}

async function scrapeWebsite(id) {
    try {
        const response = await fetch(`/api/admin/scrape/${id}`, {
            method: 'POST'
        });

        const result = await response.json();

        if (response.ok) {
            showToast(result.message, 'success');
            loadWebsites();
            loadHackathons();
        } else {
            showToast(result.error || 'Failed to scrape website', 'error');
        }
    } catch (error) {
        console.error('Error scraping website:', error);
        showToast('Error scraping website', 'error');
    }
}

async function triggerScrapeAll() {
    try {
        const response = await fetch('/api/admin/scrape-all', {
            method: 'POST'
        });

        const result = await response.json();

        if (response.ok) {
            showToast(result.message, 'success');
            setTimeout(() => {
                loadWebsites();
                loadHackathons();
            }, 2000);
        } else {
            showToast(result.error || 'Failed to start scraping', 'error');
        }
    } catch (error) {
        console.error('Error triggering scrape all:', error);
        showToast('Error starting scraping', 'error');
    }
}

async function deleteWebsite(id) {
    if (!confirm('Are you sure you want to delete this website configuration?')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/websites/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            showToast('Website deleted successfully!', 'success');
            loadWebsites();
        } else {
            showToast(result.error || 'Failed to delete website', 'error');
        }
    } catch (error) {
        console.error('Error deleting website:', error);
        showToast('Error deleting website', 'error');
    }
}

function editWebsite(id) {
    // For now, show a simple prompt - in a real app, you'd open an edit modal
    showToast('Edit functionality coming soon!', 'warning');
}

// Utility Functions
function changePage(page) {
    currentPage = page;
    loadHackathons();
}

function updateHackathonCount(total) {
    document.getElementById('hackathon-count').textContent = total;
}

function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('hackathons-grid').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('hackathons-grid').style.display = 'grid';
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateRange(startDate, endDate) {
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    return `${start} - ${end}`;
}

// Extract and Save Functions
async function handleExtractAndSave(event) {
    event.preventDefault();

    const url = document.getElementById('extract-url').value;
    const resultsDiv = document.getElementById('extraction-results');
    const contentDiv = document.getElementById('extraction-content');

    if (!url) {
        showToast('Please enter a URL', 'error');
        return;
    }

    // Show loading state
    resultsDiv.style.display = 'block';
    contentDiv.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <i class="fas fa-spinner fa-spin fa-2x" style="color: #667eea; margin-bottom: 1rem;"></i>
            <p>Extracting hackathon data from URL...</p>
            <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">This may take 10-30 seconds</p>
        </div>
    `;

    try {
        const response = await fetch('/api/admin/extract-and-save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            displayExtractionResults(result);
            showToast(`Successfully processed ${result.data.saved.length} hackathons!`, 'success');

            // Refresh hackathons list
            loadHackathons();

            // Clear the form
            document.getElementById('extract-url-form').reset();
        } else {
            contentDiv.innerHTML = `
                <div style="color: #dc3545; text-align: center; padding: 1rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                    <p><strong>Extraction Failed</strong></p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">${result.error || 'No hackathon data found'}</p>
                    ${result.details ? `<p style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">${result.details}</p>` : ''}
                </div>
            `;
            showToast(result.error || 'Failed to extract hackathon data', 'error');
        }
    } catch (error) {
        console.error('Error extracting hackathon data:', error);
        contentDiv.innerHTML = `
            <div style="color: #dc3545; text-align: center; padding: 1rem;">
                <i class="fas fa-exclamation-triangle" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                <p><strong>Network Error</strong></p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">Please check your connection and try again</p>
            </div>
        `;
        showToast('Network error occurred', 'error');
    }
}

async function testGeminiExtraction() {
    const url = document.getElementById('extract-url').value;
    const resultsDiv = document.getElementById('extraction-results');
    const contentDiv = document.getElementById('extraction-content');

    if (!url) {
        showToast('Please enter a URL', 'error');
        return;
    }

    // Show loading state
    resultsDiv.style.display = 'block';
    contentDiv.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <i class="fas fa-spinner fa-spin fa-2x" style="color: #667eea; margin-bottom: 1rem;"></i>
            <p>Testing extraction (not saving to database)...</p>
            <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">This may take 10-30 seconds</p>
        </div>
    `;

    try {
        const response = await fetch('/api/admin/test-gemini', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        const result = await response.json();

        if (response.ok && result.success && result.result.data && result.result.data.hackathons) {
            displayTestResults(result.result.data);
            showToast(`Test completed! Found ${result.result.data.hackathons.length} hackathons`, 'success');
        } else {
            contentDiv.innerHTML = `
                <div style="color: #dc3545; text-align: center; padding: 1rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                    <p><strong>Test Failed</strong></p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">${result.error || 'No hackathon data found'}</p>
                </div>
            `;
            showToast(result.error || 'Test failed', 'error');
        }
    } catch (error) {
        console.error('Error testing extraction:', error);
        contentDiv.innerHTML = `
            <div style="color: #dc3545; text-align: center; padding: 1rem;">
                <i class="fas fa-exclamation-triangle" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                <p><strong>Network Error</strong></p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">Please check your connection and try again</p>
            </div>
        `;
        showToast('Network error occurred', 'error');
    }
}

function displayExtractionResults(result) {
    const contentDiv = document.getElementById('extraction-content');
    const { saved, skipped, totalFound, confidence } = result.data;

    contentDiv.innerHTML = `
        <div class="extraction-summary">
            <div class="summary-item">
                <div class="number">${totalFound}</div>
                <div class="label">Total Found</div>
            </div>
            <div class="summary-item">
                <div class="number">${saved.length}</div>
                <div class="label">Saved</div>
            </div>
            <div class="summary-item">
                <div class="number">${skipped.length}</div>
                <div class="label">Skipped</div>
            </div>
            <div class="summary-item">
                <div class="number">${Math.round(confidence * 100)}%</div>
                <div class="label">Confidence</div>
            </div>
        </div>

        ${saved.length > 0 ? `
            <div style="margin-bottom: 1.5rem;">
                <h5 style="color: #28a745; margin-bottom: 1rem;">✅ Successfully Processed:</h5>
                ${saved.map(hackathon => `
                    <div class="hackathon-item">
                        <span class="hackathon-name">${hackathon.name}</span>
                        <span class="hackathon-action action-${hackathon.action}">${hackathon.action.toUpperCase()}</span>
                    </div>
                `).join('')}
            </div>
        ` : ''}

        ${skipped.length > 0 ? `
            <div>
                <h5 style="color: #ffc107; margin-bottom: 1rem;">⚠️ Skipped Items:</h5>
                ${skipped.map(item => `
                    <div class="hackathon-item">
                        <span class="hackathon-name">${item.title}</span>
                        <small style="color: #666; margin-left: 0.5rem;">${item.reason}</small>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
}

function displayTestResults(data) {
    const contentDiv = document.getElementById('extraction-content');
    const { hackathons, confidence, metadata } = data;

    contentDiv.innerHTML = `
        <div class="extraction-summary">
            <div class="summary-item">
                <div class="number">${hackathons.length}</div>
                <div class="label">Hackathons Found</div>
            </div>
            <div class="summary-item">
                <div class="number">${Math.round(confidence * 100)}%</div>
                <div class="label">Confidence</div>
            </div>
            <div class="summary-item">
                <div class="number">${metadata?.dataQuality || 'Unknown'}</div>
                <div class="label">Data Quality</div>
            </div>
        </div>

        <div style="margin-top: 1.5rem;">
            <h5 style="color: #17a2b8; margin-bottom: 1rem;">🔍 Preview (Not Saved):</h5>
            ${hackathons.map(hackathon => `
                <div class="hackathon-item">
                    <div class="hackathon-name">${hackathon.title || 'Untitled'}</div>
                    <div style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">
                        ${hackathon.description ? hackathon.description.substring(0, 200) + '...' : 'No description'}
                    </div>
                    <div style="font-size: 0.8rem; color: #888; margin-top: 0.5rem;">
                        📅 ${hackathon.startDate || 'No date'} | 📍 ${hackathon.location?.city || hackathon.location?.type || 'No location'}
                    </div>
                </div>
            `).join('')}
        </div>

        <div style="margin-top: 1rem; padding: 1rem; background: #e3f2fd; border-radius: 6px; border-left: 4px solid #2196f3;">
            <small style="color: #1565c0;">
                <strong>Note:</strong> This is a test preview only. Use "Extract & Save Hackathons" to actually save the data to your database.
            </small>
        </div>
    `;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;

    document.getElementById('toast-container').appendChild(toast);

    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);

    // Hide and remove toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
