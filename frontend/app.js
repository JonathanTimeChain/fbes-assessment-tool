/**
 * FBES Self-Assessment Tool
 * Frontend Application
 * 
 * Responses are stored in localStorage until assessment completion,
 * then sent to backend in a single request.
 */

const API_BASE = '';

// State
let currentUser = null;
let categoriesData = null;
let currentCategoryIndex = 0;
let currentAssessmentId = null;
let assessmentResponses = {};  // Stored in localStorage

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    checkAuth();
    setupEventListeners();
});

async function loadCategories() {
    try {
        const res = await fetch(`${API_BASE}/api/categories`);
        if (res.ok) {
            categoriesData = await res.json();
        }
    } catch (e) {
        console.error('Failed to load categories:', e);
    }
}

function setupEventListeners() {
    // Auth buttons
    document.getElementById('btn-login')?.addEventListener('click', () => showModal('auth'));
    document.getElementById('btn-register')?.addEventListener('click', () => showModal('auth'));
    document.getElementById('btn-logout')?.addEventListener('click', logout);
    
    // Auth forms
    document.getElementById('form-login')?.addEventListener('submit', handleLogin);
    document.getElementById('form-register')?.addEventListener('submit', handleRegister);
    document.getElementById('show-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('auth-login').style.display = 'none';
        document.getElementById('auth-register').style.display = 'block';
    });
    document.getElementById('show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('auth-register').style.display = 'none';
        document.getElementById('auth-login').style.display = 'block';
    });
    
    // Modal close
    document.querySelectorAll('.close').forEach(el => {
        el.addEventListener('click', () => hideModal());
    });
    
    // Start assessment
    document.getElementById('btn-start')?.addEventListener('click', () => {
        if (!currentUser) {
            showModal('auth');
        } else {
            showPage('program-info');
        }
    });
    
    // Program info form
    document.getElementById('form-program-info')?.addEventListener('submit', handleCreateAssessment);
    
    // New assessment from dashboard
    document.getElementById('btn-new-assessment')?.addEventListener('click', () => showPage('program-info'));
}

// ==========================================
// AUTHENTICATION
// ==========================================

function checkAuth() {
    const token = localStorage.getItem('fbes_token');
    const userStr = localStorage.getItem('fbes_user');
    
    if (token && userStr) {
        try {
            currentUser = JSON.parse(userStr);
            updateNavForUser();
        } catch (e) {
            localStorage.removeItem('fbes_token');
            localStorage.removeItem('fbes_user');
        }
    }
}

function getAuthHeaders() {
    const token = localStorage.getItem('fbes_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function updateNavForUser() {
    document.getElementById('nav-guest').style.display = currentUser ? 'none' : 'flex';
    document.getElementById('nav-user').style.display = currentUser ? 'flex' : 'none';
    if (currentUser) {
        document.getElementById('user-email').textContent = currentUser.email;
    }
}

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
            localStorage.setItem('fbes_token', data.token);
            localStorage.setItem('fbes_user', JSON.stringify(data.user));
            currentUser = data.user;
            updateNavForUser();
            hideModal();
            showPage('dashboard');
            loadAssessments();
        } else {
            const err = await res.json().catch(() => ({}));
            alert(err.detail || 'Login failed');
        }
    } catch (e) {
        alert('Login failed: ' + e.message);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const name = document.getElementById('register-name').value;
    
    try {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
        });
        
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('fbes_token', data.token);
            localStorage.setItem('fbes_user', JSON.stringify(data.user));
            currentUser = data.user;
            updateNavForUser();
            hideModal();
            showPage('dashboard');
            loadAssessments();
        } else {
            const err = await res.json().catch(() => ({}));
            alert(err.detail || 'Registration failed');
        }
    } catch (e) {
        alert('Registration failed: ' + e.message);
    }
}

function logout() {
    localStorage.removeItem('fbes_token');
    localStorage.removeItem('fbes_user');
    currentUser = null;
    updateNavForUser();
    showPage('landing');
}

// ==========================================
// PAGE NAVIGATION
// ==========================================

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${pageId}`)?.classList.add('active');
    window.scrollTo(0, 0);
}

function showModal(modalId) {
    document.getElementById(`modal-${modalId}`).style.display = 'flex';
}

function hideModal() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

// ==========================================
// DASHBOARD
// ==========================================

async function loadAssessments() {
    try {
        const res = await fetch(`${API_BASE}/api/assessments`, { headers: getAuthHeaders() });
        if (res.ok) {
            const assessments = await res.json();
            renderAssessments(assessments);
        }
    } catch (e) {
        console.error('Failed to load assessments:', e);
    }
}

function renderAssessments(assessments) {
    const container = document.getElementById('assessments-container');
    
    if (!assessments || assessments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>You haven't started any assessments yet.</p>
                <button class="btn btn-primary" onclick="showPage('program-info')">Start Your First Assessment</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = assessments.map(a => `
        <div class="assessment-card">
            <div>
                <h3>${a.program_name}</h3>
                <div class="meta">
                    ${a.status === 'completed' ? 'Completed' : 'In Progress'} • 
                    ${new Date(a.created_at).toLocaleDateString()}
                </div>
            </div>
            <div>
                ${a.status === 'completed' 
                    ? `<span class="score">${Math.round(a.overall_score)}%</span>` 
                    : `<button class="btn btn-secondary" onclick="resumeAssessment(${a.id})">Continue</button>`
                }
            </div>
        </div>
    `).join('');
}

// ==========================================
// ASSESSMENT CREATION
// ==========================================

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
            
            // Initialize fresh responses in localStorage
            assessmentResponses = {};
            saveResponsesToLocalStorage();
            
            showPage('assessment');
            renderCategory();
        } else {
            const errData = await res.json().catch(() => ({}));
            alert('Failed to create assessment: ' + (errData.detail || res.statusText));
        }
    } catch (e) {
        alert('Failed to create assessment: ' + e.message);
    }
}

async function resumeAssessment(assessmentId) {
    try {
        const res = await fetch(`${API_BASE}/api/assessments/${assessmentId}`, { headers: getAuthHeaders() });
        if (res.ok) {
            const assessment = await res.json();
            currentAssessmentId = assessment.id;
            
            // Load responses from localStorage if available, otherwise from server
            const localKey = `fbes_responses_${assessmentId}`;
            const localData = localStorage.getItem(localKey);
            
            if (localData) {
                assessmentResponses = JSON.parse(localData);
            } else {
                assessmentResponses = assessment.responses || {};
                saveResponsesToLocalStorage();
            }
            
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

// ==========================================
// LOCAL STORAGE FOR RESPONSES
// ==========================================

function saveResponsesToLocalStorage() {
    if (currentAssessmentId) {
        const key = `fbes_responses_${currentAssessmentId}`;
        localStorage.setItem(key, JSON.stringify(assessmentResponses));
    }
}

function clearLocalResponses() {
    if (currentAssessmentId) {
        const key = `fbes_responses_${currentAssessmentId}`;
        localStorage.removeItem(key);
    }
}

// ==========================================
// QUESTION RENDERING
// ==========================================

function renderCategory() {
    if (!categoriesData) return;
    
    const category = categoriesData.categories[currentCategoryIndex];
    const totalCategories = categoriesData.categories.length;
    
    // Update header
    document.getElementById('category-title').textContent = category.name;
    document.getElementById('category-description').textContent = category.description;
    document.getElementById('category-weight').textContent = `Weight: ${Math.round(category.weight * 100)}%`;
    document.getElementById('progress-text').textContent = `Category ${currentCategoryIndex + 1} of ${totalCategories}`;
    document.getElementById('progress-fill').style.width = `${((currentCategoryIndex + 1) / totalCategories) * 100}%`;
    
    // Get existing responses for this category
    const catId = String(category.id);
    const catResponses = assessmentResponses[catId] || {};
    
    // Render questions
    const container = document.getElementById('questions-container');
    container.innerHTML = category.questions.map((q, idx) => {
        const response = catResponses[q.id] || {};
        return `
            <div class="question-card">
                <h4><span class="question-number">${q.id}</span> ${q.text}</h4>
                ${q.guidance ? `<p class="question-guidance">${q.guidance}</p>` : ''}
                <div class="answer-options">
                    <div class="answer-option">
                        <input type="radio" name="q-${q.id}" id="q-${q.id}-yes" value="yes"
                            ${response.answer === 'yes' ? 'checked' : ''}>
                        <label for="q-${q.id}-yes">Yes</label>
                    </div>
                    <div class="answer-option">
                        <input type="radio" name="q-${q.id}" id="q-${q.id}-partial" value="partial"
                            ${response.answer === 'partial' ? 'checked' : ''}>
                        <label for="q-${q.id}-partial">Partial</label>
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
    document.getElementById('btn-prev').style.visibility = currentCategoryIndex === 0 ? 'hidden' : 'visible';
    const nextBtn = document.getElementById('btn-next');
    nextBtn.textContent = currentCategoryIndex === totalCategories - 1 ? 'Complete Assessment' : 'Next Category →';
}

function collectCurrentResponses() {
    if (!categoriesData) return;
    
    const category = categoriesData.categories[currentCategoryIndex];
    const catId = String(category.id);
    const catResponses = {};
    
    category.questions.forEach(q => {
        const selected = document.querySelector(`input[name="q-${q.id}"]:checked`);
        if (selected) {
            catResponses[q.id] = { answer: selected.value };
        }
    });
    
    assessmentResponses[catId] = catResponses;
    saveResponsesToLocalStorage();
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
    
    if (currentCategoryIndex < categoriesData.categories.length - 1) {
        currentCategoryIndex++;
        renderCategory();
        window.scrollTo(0, 0);
    } else {
        // Complete assessment - send all responses to backend
        await completeAssessment();
    }
}

// ==========================================
// ASSESSMENT COMPLETION
// ==========================================

async function completeAssessment() {
    // Collect final responses
    collectCurrentResponses();
    
    const btn = document.getElementById('btn-next');
    btn.disabled = true;
    btn.textContent = 'Submitting...';
    
    try {
        // First, save all responses to backend
        await fetch(`${API_BASE}/api/assessments/${currentAssessmentId}/responses`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(assessmentResponses)
        });
        
        // Then complete the assessment
        const res = await fetch(`${API_BASE}/api/assessments/${currentAssessmentId}/complete`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        
        if (res.ok) {
            const results = await res.json();
            clearLocalResponses();  // Clean up localStorage
            showResults(results);
        } else {
            const err = await res.json().catch(() => ({}));
            alert('Failed to complete assessment: ' + (err.detail || 'Unknown error'));
            btn.disabled = false;
            btn.textContent = 'Complete Assessment';
        }
    } catch (e) {
        alert('Failed to complete assessment: ' + e.message);
        btn.disabled = false;
        btn.textContent = 'Complete Assessment';
    }
}

// ==========================================
// RESULTS DISPLAY
// ==========================================

function showResults(results) {
    showPage('results');
    
    // Overall score
    document.querySelector('.score-number').textContent = Math.round(results.overall_score);
    
    // Readiness badge
    const readiness = results.readiness || (results.overall_score >= 75 ? 'ready' : (results.overall_score >= 50 ? 'promising' : 'needs_work'));
    const badge = document.getElementById('readiness-badge');
    badge.className = 'readiness-badge ' + readiness;
    badge.textContent = readiness === 'ready' 
        ? 'Ready for FBES Review' 
        : (readiness === 'promising' ? 'Promising — Minor Gaps' : 'Needs Development');
    
    // Category scores
    const catContainer = document.getElementById('category-scores');
    const categoryScores = results.category_scores || {};
    
    catContainer.innerHTML = Object.entries(categoryScores).map(([id, data]) => `
        <div class="category-score-card">
            <h4>${data.name}</h4>
            <div class="score-bar">
                <div class="score-fill ${data.status}" style="width: ${data.raw_score}%"></div>
            </div>
            <span class="score-text">${data.raw_score}% (${data.status})</span>
        </div>
    `).join('');
    
    // Recommendations
    const recsContainer = document.getElementById('recommendations');
    const recommendations = results.recommendations || [];
    
    if (recommendations.length === 0) {
        recsContainer.innerHTML = '<p style="color: var(--gray-400);">No recommendations — your curriculum meets all FBES criteria!</p>';
    } else {
        recsContainer.innerHTML = recommendations.map(rec => `
            <div class="recommendation-card">
                <span class="category-tag">${rec.category}</span>
                <p class="question-text">${rec.question}</p>
                ${rec.guidance ? `<p class="guidance">${rec.guidance}</p>` : ''}
            </div>
        `).join('');
    }
}

function backToDashboard() {
    showPage('dashboard');
    loadAssessments();
}

function startNewAssessment() {
    showPage('program-info');
    // Reset form
    document.getElementById('form-program-info')?.reset();
}

// Make functions globally available
window.prevCategory = prevCategory;
window.nextCategory = nextCategory;
window.resumeAssessment = resumeAssessment;
window.backToDashboard = backToDashboard;
window.startNewAssessment = startNewAssessment;
window.showPage = showPage;
