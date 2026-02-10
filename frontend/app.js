// FBES Self-Assessment Tool - Frontend Application

const API_BASE = '';

// State
let currentUser = null;
let currentAssessmentId = null;
let currentCategoryIndex = 0;
let categoriesData = null;
let assessmentResponses = {};

// Auth token helper
function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// DOM Elements
const pages = {
    landing: document.getElementById('page-landing'),
    dashboard: document.getElementById('page-dashboard'),
    newAssessment: document.getElementById('page-new-assessment'),
    assessment: document.getElementById('page-assessment'),
    results: document.getElementById('page-results')
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadCategories();
    setupEventListeners();
});

// Auth check
async function checkAuth() {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { 
            headers: getAuthHeaders()
        });
        if (res.ok) {
            currentUser = await res.json();
            showAuthenticatedUI();
        } else {
            localStorage.removeItem('access_token');
        }
    } catch (e) {
        console.log('Not authenticated');
    }
}

// Load categories data
async function loadCategories() {
    try {
        const res = await fetch(`${API_BASE}/api/categories`);
        categoriesData = await res.json();
    } catch (e) {
        console.error('Failed to load categories:', e);
    }
}

// Event Listeners
function setupEventListeners() {
    // Auth buttons
    document.getElementById('btn-login').addEventListener('click', () => showModal('login'));
    document.getElementById('btn-register').addEventListener('click', () => showModal('register'));
    document.getElementById('btn-logout').addEventListener('click', logout);
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        toggleAuthForm('register');
    });
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        toggleAuthForm('login');
    });
    
    // Modal close
    document.querySelector('.modal .close').addEventListener('click', closeModal);
    document.getElementById('modal-auth').addEventListener('click', (e) => {
        if (e.target.id === 'modal-auth') closeModal();
    });
    
    // Auth forms
    document.getElementById('form-login').addEventListener('submit', handleLogin);
    document.getElementById('form-register').addEventListener('submit', handleRegister);
    
    // Start assessment
    document.getElementById('btn-start-assessment').addEventListener('click', () => {
        if (currentUser) {
            showPage('dashboard');
        } else {
            showModal('register');
        }
    });
    
    // Dashboard
    document.getElementById('btn-new-assessment').addEventListener('click', () => showPage('newAssessment'));
    
    // New assessment form
    document.getElementById('form-program-info').addEventListener('submit', handleCreateAssessment);
    
    // Assessment navigation
    document.getElementById('btn-prev-category').addEventListener('click', prevCategory);
    document.getElementById('btn-next-category').addEventListener('click', nextCategory);
    document.getElementById('btn-save-progress').addEventListener('click', saveProgress);
}

// Page navigation
function showPage(pageName) {
    Object.values(pages).forEach(p => p.classList.remove('active'));
    pages[pageName].classList.add('active');
    
    if (pageName === 'dashboard') {
        loadAssessments();
    }
}

// Modal
function showModal(type) {
    document.getElementById('modal-auth').style.display = 'flex';
    toggleAuthForm(type);
}

function closeModal() {
    document.getElementById('modal-auth').style.display = 'none';
}

function toggleAuthForm(type) {
    document.getElementById('auth-login').style.display = type === 'login' ? 'block' : 'none';
    document.getElementById('auth-register').style.display = type === 'register' ? 'block' : 'none';
}

// Auth handlers
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('access_token', data.token);
            currentUser = data.user;
            showAuthenticatedUI();
            closeModal();
            showPage('dashboard');
        } else {
            alert('Invalid credentials');
        }
    } catch (e) {
        alert('Login failed');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const name = document.getElementById('register-name').value;
    const organization = document.getElementById('register-org').value;
    
    try {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, organization })
        });
        
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('access_token', data.token);
            currentUser = data.user;
            showAuthenticatedUI();
            closeModal();
            showPage('dashboard');
        } else {
            const data = await res.json();
            alert(data.detail || 'Registration failed');
        }
    } catch (e) {
        console.error('Registration error:', e);
        alert('Registration failed');
    }
}

async function logout() {
    localStorage.removeItem('access_token');
    currentUser = null;
    showUnauthenticatedUI();
    showPage('landing');
}

function showAuthenticatedUI() {
    document.getElementById('nav-auth').style.display = 'none';
    document.getElementById('nav-user').style.display = 'flex';
    document.getElementById('user-email').textContent = currentUser.email;
}

function showUnauthenticatedUI() {
    document.getElementById('nav-auth').style.display = 'flex';
    document.getElementById('nav-user').style.display = 'none';
}

// Assessments
async function loadAssessments() {
    try {
        const res = await fetch(`${API_BASE}/api/assessments`, { headers: getAuthHeaders() });
        if (res.ok) {
            const assessments = await res.json();
            renderAssessmentsList(assessments);
        }
    } catch (e) {
        console.error('Failed to load assessments:', e);
    }
}

function renderAssessmentsList(assessments) {
    const container = document.getElementById('assessments-list');
    
    if (assessments.length === 0) {
        container.innerHTML = '<p class="empty-state">No assessments yet. Start your first one!</p>';
        return;
    }
    
    container.innerHTML = assessments.map(a => `
        <div class="assessment-card">
            <div>
                <h3>${a.program_name}</h3>
                <p class="meta">
                    ${a.status === 'completed' ? 'Completed' : 'In Progress'} · 
                    ${new Date(a.updated_at).toLocaleDateString()}
                </p>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                ${a.status === 'completed' 
                    ? `<span class="score">${a.overall_score}%</span>` 
                    : ''}
                <button class="btn btn-outline" onclick="resumeAssessment(${a.id})">
                    ${a.status === 'completed' ? 'View Results' : 'Continue'}
                </button>
            </div>
        </div>
    `).join('');
}

async function handleCreateAssessment(e) {
    e.preventDefault();
    
    const programInfo = {
        program_name: document.getElementById('program-name').value,
        organization: document.getElementById('program-org').value,
        program_level: document.getElementById('program-level').value,
        target_audience: Array.from(document.querySelectorAll('input[name="audience"]:checked')).map(c => c.value),
        delivery_format: Array.from(document.querySelectorAll('input[name="format"]:checked')).map(c => c.value)
    };
    
    try {
        const res = await fetch(`${API_BASE}/api/assessments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(programInfo)
        });
        
        if (res.ok) {
            const data = await res.json();
            currentAssessmentId = data.id;
            currentCategoryIndex = 0;
            assessmentResponses = {};
            showPage('assessment');
            renderCategory();
        } else {
            const errData = await res.json().catch(() => ({}));
            console.error('Create assessment failed:', res.status, errData);
            alert('Failed to create assessment: ' + (errData.detail || res.statusText));
        }
    } catch (e) {
        console.error('Create assessment error:', e);
        alert('Failed to create assessment: ' + e.message);
    }
}

async function resumeAssessment(assessmentId) {
    try {
        const res = await fetch(`${API_BASE}/api/assessments/${assessmentId}`, { headers: getAuthHeaders() });
        if (res.ok) {
            const assessment = await res.json();
            currentAssessmentId = assessment.id;
            assessmentResponses = assessment.responses || {};
            
            if (assessment.status === 'completed') {
                showResults(assessment);
            } else {
                currentCategoryIndex = 0;
                showPage('assessment');
                renderCategory();
            }
        }
    } catch (e) {
        console.error('Failed to load assessment:', e);
    }
}

// Question rendering
function renderCategory() {
    if (!categoriesData) return;
    
    const category = categoriesData.categories[currentCategoryIndex];
    const totalCategories = categoriesData.categories.length;
    
    // Update header
    document.getElementById('category-title').textContent = category.name;
    document.getElementById('progress-text').textContent = `Category ${currentCategoryIndex + 1} of ${totalCategories}`;
    document.getElementById('progress-fill').style.width = `${((currentCategoryIndex + 1) / totalCategories) * 100}%`;
    
    // Render questions
    const container = document.getElementById('questions-container');
    const catResponses = assessmentResponses[category.id] || {};
    
    container.innerHTML = category.questions.map((q, idx) => {
        const response = catResponses[q.id] || {};
        return `
            <div class="question-card">
                <h4>${idx + 1}. ${q.text}</h4>
                <p class="question-guidance">${q.guidance}</p>
                <div class="answer-options">
                    <div class="answer-option">
                        <input type="radio" name="q-${q.id}" id="q-${q.id}-yes" value="yes" 
                            ${response.answer === 'yes' ? 'checked' : ''}>
                        <label for="q-${q.id}-yes">Yes</label>
                    </div>
                    <div class="answer-option">
                        <input type="radio" name="q-${q.id}" id="q-${q.id}-partial" value="partial"
                            ${response.answer === 'partial' ? 'checked' : ''}>
                        <label for="q-${q.id}-partial">Partially</label>
                    </div>
                    <div class="answer-option">
                        <input type="radio" name="q-${q.id}" id="q-${q.id}-no" value="no"
                            ${response.answer === 'no' ? 'checked' : ''}>
                        <label for="q-${q.id}-no">No</label>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Update nav buttons
    document.getElementById('btn-prev-category').style.display = currentCategoryIndex === 0 ? 'none' : 'block';
    document.getElementById('btn-next-category').textContent = 
        currentCategoryIndex === totalCategories - 1 ? 'Complete Assessment' : 'Next Category';
}

function collectCurrentResponses() {
    if (!categoriesData) return;
    
    const category = categoriesData.categories[currentCategoryIndex];
    const catResponses = {};
    
    category.questions.forEach(q => {
        const selected = document.querySelector(`input[name="q-${q.id}"]:checked`);
        if (selected) {
            catResponses[q.id] = { answer: selected.value };
        }
    });
    
    assessmentResponses[category.id] = catResponses;
}

async function saveProgress() {
    collectCurrentResponses();
    
    try {
        await fetch(`${API_BASE}/api/assessments/${currentAssessmentId}/responses`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(assessmentResponses)
        });
        alert('Progress saved!');
    } catch (e) {
        alert('Failed to save progress');
    }
}

function prevCategory() {
    collectCurrentResponses();
    if (currentCategoryIndex > 0) {
        currentCategoryIndex--;
        renderCategory();
        window.scrollTo(0, 0);
    }
}

async function nextCategory() {
    collectCurrentResponses();
    await saveProgress();
    
    if (currentCategoryIndex < categoriesData.categories.length - 1) {
        currentCategoryIndex++;
        renderCategory();
        window.scrollTo(0, 0);
    } else {
        // Complete assessment
        await completeAssessment();
    }
}

async function completeAssessment() {
    try {
        const res = await fetch(`${API_BASE}/api/assessments/${currentAssessmentId}/complete`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        
        if (res.ok) {
            const results = await res.json();
            showResults(results);
        }
    } catch (e) {
        alert('Failed to complete assessment');
    }
}

function showResults(results) {
    showPage('results');
    
    // Overall score
    document.querySelector('.score-number').textContent = Math.round(results.overall_score);
    
    // Readiness badge
    const badge = document.getElementById('readiness-badge');
    badge.className = 'readiness-badge ' + results.readiness;
    badge.textContent = results.readiness === 'ready' ? 'Ready for FBES Review' 
        : results.readiness === 'promising' ? 'Promising - Some Improvements Needed'
        : 'Needs Significant Work';
    
    // Category scores
    const catContainer = document.getElementById('category-scores');
    catContainer.innerHTML = Object.entries(results.category_scores).map(([id, data]) => `
        <div class="category-score-card">
            <h4>${data.name}</h4>
            <div class="score-bar">
                <div class="score-fill ${data.status}" style="width: ${data.raw_score}%"></div>
            </div>
            <span class="score-text">${data.raw_score}%</span>
        </div>
    `).join('');
    
    // Recommendations
    const recContainer = document.getElementById('recommendations');
    if (results.recommendations && results.recommendations.length > 0) {
        recContainer.innerHTML = results.recommendations.map(r => `
            <div class="recommendation-card">
                <span class="category-tag">${r.category}</span>
                <h4>${r.question}</h4>
                <p>${r.guidance}</p>
            </div>
        `).join('');
    } else {
        recContainer.innerHTML = '<p class="empty-state">No recommendations - your curriculum looks great!</p>';
    }
}

// Make functions available globally for onclick handlers
window.showPage = showPage;
window.resumeAssessment = resumeAssessment;
