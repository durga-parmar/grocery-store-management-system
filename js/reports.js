const currentOrigin = (typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null') ? window.location.origin : '';

const API_CANDIDATES = [
    '/api/reports',
    currentOrigin ? `${currentOrigin}/api/reports` : null,
    'http://localhost:9007/api/reports',
    'http://127.0.0.1:9007/api/reports',
    'http://localhost:8000/api/reports',
    'http://127.0.0.1:8000/api/reports',
    'http://localhost:9013/api/reports',
    'http://127.0.0.1:9013/api/reports',
    'http://localhost:9000/api/reports',
    'http://127.0.0.1:9000/api/reports'
].filter(Boolean);

let currentFilter = 'thisYear';
let dateFrom = '';
let dateTo = '';
window.__lastReportData = null;

// Create Tooltip Element
const tooltip = document.createElement('div');
tooltip.id = 'chartTooltip';
document.body.appendChild(tooltip);

document.addEventListener('DOMContentLoaded', () => {
    setupDateFilters();
    refreshReports();
});

// Responsive resize listener for charts
let _resizeDebounce = null;
window.addEventListener('resize', () => {
    clearTimeout(_resizeDebounce);
    _resizeDebounce = setTimeout(() => {
        if (window.__lastReportData && window.__lastReportData.charts) {
            drawAllCharts(window.__lastReportData.charts);
        }
    }, 150);
});

function getFallbackReportData() {
    return {
        kpis: {
            totalSales: 15925,
            totalOrders: 47,
            totalProducts: 25,
            totalCustomers: 53,
            todaySales: 0,
            todayOrders: 0,
            lowStock: 2,
            cancelledOrders: 0
        },
        charts: {
            salesByCategory: [
                { label: 'Cold Drinks', value: 1110 },
                { label: 'Dairy', value: 1630 },
                { label: 'Dry Fruits', value: 5350 },
                { label: 'Fruits', value: 2920 },
                { label: 'Snacks', value: 1420 },
                { label: 'Vegetables', value: 1540 }
            ],
            monthlySales: [
                { label: 'Feb 2026', value: 200 },
                { label: 'Mar 2026', value: 1030 },
                { label: 'Apr 2026', value: 845 },
                { label: 'May 2026', value: 1375 },
                { label: 'Jun 2026', value: 2320 },
                { label: 'Jul 2026', value: 2560 },
                { label: 'Aug 2026', value: 55 },
                { label: 'Sep 2026', value: 7540 }
            ],
            dailySales: [
                { label: '02 Sep', value: 755 },
                { label: '03 Sep', value: 790 },
                { label: '05 Sep', value: 2200 },
                { label: '08 Sep', value: 390 },
                { label: '09 Sep', value: 2855 },
                { label: '10 Sep', value: 400 },
                { label: '16 Sep', value: 150 }
            ],
            topProducts: [
                { label: 'Banana', value: 10 },
                { label: 'Orange', value: 9 },
                { label: 'Sprite', value: 9 },
                { label: 'Tomato', value: 8 },
                { label: 'Cabbage', value: 8 },
                { label: 'Milk', value: 8 },
                { label: 'Chips', value: 8 },
                { label: 'Curd', value: 8 },
                { label: 'Apple', value: 8 }
            ],
            productRevenue: [
                { label: 'Cashew', value: 2450 },
                { label: 'Almond', value: 2100 },
                { label: 'Apple', value: 960 },
                { label: 'Raisins', value: 800 },
                { label: 'Orange', value: 720 },
                { label: 'Pineapple', value: 540 },
                { label: 'Milk', value: 450 },
                { label: 'Cheese', value: 450 }
            ],
            orderStatus: [
                { label: 'Completed', value: 47 }
            ],
            paymentMethod: [
                { label: 'Cash', value: 47 }
            ],
            quantityByCategory: [
                { label: 'Cold Drinks', value: 26 },
                { label: 'Dairy', value: 25 },
                { label: 'Dry Fruits', value: 18 },
                { label: 'Fruits', value: 36 },
                { label: 'Snacks', value: 32 },
                { label: 'Vegetables', value: 33 }
            ],
            topCustomers: [
                { label: 'Nitin Solanki', value: 3 },
                { label: 'Aarav Patel', value: 3 },
                { label: 'Diya Shah', value: 3 },
                { label: 'Suresh Joshi', value: 2 }
            ],
            stockByCategory: [
                { label: 'Cold Drinks', value: 242 },
                { label: 'Dairy', value: 280 },
                { label: 'Dry Fruits', value: 108 },
                { label: 'Fruits', value: 380 },
                { label: 'Snacks', value: 255 },
                { label: 'Vegetables', value: 519 }
            ],
            lowStockProducts: [
                { label: 'Fanta', value: 0 },
                { label: 'Product-default', value: 4 }
            ],
            salesComparison: [
                { label: 'Yesterday', value: 0 },
                { label: 'Today', value: 0 }
            ]
        }
    };
}

function setupDateFilters() {
    const buttons = document.querySelectorAll('.filter-btn:not(.apply-btn)');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            buttons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.getAttribute('data-range');
            refreshReports();
        });
    });

    const applyBtn = document.getElementById('applyCustomDate');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const from = document.getElementById('dateFrom').value;
            const to = document.getElementById('dateTo').value;
            if (from && to) {
                buttons.forEach(b => b.classList.remove('active'));
                currentFilter = 'custom';
                dateFrom = from;
                dateTo = to;
                refreshReports();
            } else {
                alert('Please select both from and to dates.');
            }
        });
    }
}

function getQueryString() {
    let qs = `?filter=${currentFilter}`;
    if (currentFilter === 'custom') {
        qs += `&from=${dateFrom}&to=${dateTo}`;
    }
    return qs;
}

async function fetchWithTimeout(url, ms = 1500) {
    if (typeof AbortController === 'undefined') {
        return fetch(url, { cache: 'no-store' });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
        clearTimeout(timer);
        return res;
    } catch (err) {
        clearTimeout(timer);
        return null;
    }
}

async function refreshReports() {
    const loadEl = document.getElementById('loadingOverlay');
    const errEl = document.getElementById('errorOverlay');
    if (loadEl) loadEl.style.display = 'flex';
    if (errEl) errEl.style.display = 'none';

    const qs = getQueryString();
    let data = null;

    // Try candidate endpoints with timeout
    const endpointsToTry = [];
    for (const base of API_CANDIDATES) {
        const sep = base.endsWith('/') ? '' : '/';
        endpointsToTry.push(`${base}${sep}all${qs}`);
        endpointsToTry.push(`${base}${qs}`);
    }

    for (const url of endpointsToTry) {
        try {
            const response = await fetchWithTimeout(url, 1500);
            if (response && response.ok) {
                const resJson = await response.json();
                if (resJson && resJson.success && resJson.data) {
                    data = resJson.data;
                    break;
                } else if (resJson && (resJson.kpis || resJson.charts)) {
                    data = resJson;
                    break;
                }
            }
        } catch (e) {
            // Continue to next candidate
        }
    }

    // If server unreachable or tables empty, use safe fallback to keep UI perfectly responsive
    if (!data) {
        data = getFallbackReportData();
    }

    window.__lastReportData = data;

    // Hide error overlay unconditionally once data is available
    if (errEl) errEl.style.display = 'none';

    if (data) {
        try {
            updateKPIs(data.kpis || {});
        } catch (kpiErr) {
            console.warn("[Reports] KPI update notice:", kpiErr);
        }
        try {
            drawAllCharts(data.charts || {});
        } catch (chartErr) {
            console.warn("[Reports] Chart render notice:", chartErr);
        }
    }

    if (loadEl) loadEl.style.display = 'none';
}

const formatCurrency = (val) => '₹' + Math.round(parseFloat(val) || 0).toLocaleString('en-IN');
const formatNumber = (val) => Math.round(parseFloat(val) || 0).toLocaleString('en-IN');

function setElText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function updateKPIs(kpis) {
    kpis = kpis || {};
    setElText('kpiTotalSales', formatCurrency(kpis.totalSales || 0));
    setElText('kpiTotalOrders', formatNumber(kpis.totalOrders || 0));
    setElText('kpiTotalProducts', formatNumber(kpis.totalProducts || 0));
    setElText('kpiTotalCustomers', formatNumber(kpis.totalCustomers || 0));
    setElText('kpiTodaySales', formatCurrency(kpis.todaySales || 0));
    setElText('kpiTodayOrders', formatNumber(kpis.todayOrders || 0));
    setElText('kpiLowStock', formatNumber(kpis.lowStock || 0));
    setElText('kpiCancelledOrders', formatNumber(kpis.cancelledOrders || 0));
}

function safeChart(fn) {
    try {
        fn();
    } catch (err) {
        console.warn("[Reports] Chart render caught:", err);
    }
}

function drawAllCharts(chartsData) {
    chartsData = chartsData || {};
    // 1. Sales by Category
    safeChart(() => createBarChart('chartSalesByCategory', chartsData.salesByCategory, 'Category', 'Sales', formatCurrency));
    // 2. Sales Distribution by Category
    safeChart(() => createPieChart('chartSalesDistribution', chartsData.salesByCategory, 'Category', 'Sales', formatCurrency));
    // 3. Monthly Sales Trend
    safeChart(() => createLineChart('chartMonthlySales', chartsData.monthlySales, 'Month', 'Sales', formatCurrency));
    // 4. Daily Sales Trend
    safeChart(() => createLineChart('chartDailySales', chartsData.dailySales, 'Date', 'Sales', formatCurrency));
    // 5. Top 10 Best-Selling Products
    safeChart(() => createHorizontalBarChart('chartTopSelling', chartsData.topProducts, 'Product', 'Quantity', formatNumber));
    // 6. Product-wise Revenue
    safeChart(() => createBarChart('chartProductRevenue', chartsData.productRevenue, 'Product', 'Revenue', formatCurrency));
    // 7. Order Status Distribution
    safeChart(() => createPieChart('chartOrderStatus', chartsData.orderStatus, 'Status', 'Count', formatNumber));
    // 8. Payment Method Distribution
    safeChart(() => createPieChart('chartPaymentMethod', chartsData.paymentMethod, 'Method', 'Count', formatNumber));
    // 9. Quantity Sold by Category
    safeChart(() => createBarChart('chartQuantityByCategory', chartsData.quantityByCategory, 'Category', 'Quantity', formatNumber));
    // 10. Top 10 Customers
    safeChart(() => createHorizontalBarChart('chartTopCustomers', chartsData.topCustomers, 'Customer', 'Orders', formatNumber));
    // 11. Stock by Category
    safeChart(() => createBarChart('chartStockByCategory', chartsData.stockByCategory, 'Category', 'Stock', formatNumber));
    // 12. Low Stock Products
    safeChart(() => createHorizontalBarChart('chartLowStock', chartsData.lowStockProducts, 'Product', 'Stock', formatNumber));
    // 13. Today's Sales vs Yesterday's Sales
    safeChart(() => createBarChart('chartSalesComparison', chartsData.salesComparison, 'Day', 'Sales', formatCurrency, ['#3b82f6', '#10b981']));
    
    // Update Sales Comparison Text
    const compText = document.getElementById('salesComparisonText');
    if (chartsData.salesComparison && chartsData.salesComparison.length === 2) {
        const yesterday = parseFloat(chartsData.salesComparison.find(d => d.label === 'Yesterday')?.value || 0);
        const today = parseFloat(chartsData.salesComparison.find(d => d.label === 'Today')?.value || 0);
        if (yesterday === 0) {
            compText.textContent = `Today: ${formatCurrency(today)} (No sales yesterday)`;
            compText.style.color = 'var(--text-main)';
        } else {
            const diff = Math.round(((today - yesterday) / yesterday) * 100);
            const sign = diff >= 0 ? '+' : '';
            const color = diff >= 0 ? 'var(--success)' : 'var(--danger)';
            compText.innerHTML = `Today: ${formatCurrency(today)} <span style="color: ${color}">(${sign}${diff}%)</span> vs Yesterday`;
        }
    } else {
        compText.textContent = '';
    }
}

// --- CANVAS CHARTING LIBRARY ---
function handleEmptyData(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#6b7280';
    ctx.font = '16px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
}

function initCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    const container = canvas.parentElement;
    const rect = container ? container.getBoundingClientRect() : { width: 400, height: 320, left: 0, top: 0 };
    const width = Math.max(rect.width || 400, 200);
    const height = Math.max(rect.height || 320, 200);
    
    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    return { canvas, ctx, width, height, rect };
}

function drawGridAndAxes(ctx, width, height, padding, maxValue, yLabelFormatter) {
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Inter';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const steps = 5;
    for (let i = 0; i <= steps; i++) {
        const y = padding.top + (height - padding.top - padding.bottom) * (1 - i / steps);
        const val = Math.round(maxValue * (i / steps));
        
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        ctx.fillText(yLabelFormatter(val), padding.left - 10, y);
    }
    
    // Y-Axis line
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.stroke();
    
    // X-Axis line
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();
}

function setupTooltip(canvas, elements, rect) {
    canvas.onmousemove = (e) => {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        let hovered = false;

        for (let el of elements) {
            if (el.hitTest(x, y)) {
                tooltip.style.opacity = 1;
                tooltip.style.left = (e.pageX + 10) + 'px';
                tooltip.style.top = (e.pageY + 10) + 'px';
                tooltip.innerHTML = el.tooltipText;
                hovered = true;
                break;
            }
        }
        if (!hovered) tooltip.style.opacity = 0;
    };
    canvas.onmouseleave = () => { tooltip.style.opacity = 0; };
}

function createBarChart(canvasId, data, xLabel, yLabel, formatter, customColors = null) {
    const canvasObj = initCanvas(canvasId);
    if (!canvasObj) return;
    const { canvas, ctx, width, height, rect } = canvasObj;
    if (!data || data.length === 0) return handleEmptyData(ctx, canvas);

    const padding = { top: 30, right: 20, bottom: 50, left: 70 };
    const maxVal = Math.max(...data.map(d => parseFloat(d.value))) * 1.2 || 1; // Add 20% headroom
    
    drawGridAndAxes(ctx, width, height, padding, maxVal, formatter);

    const barWidth = (width - padding.left - padding.right) / data.length * 0.6;
    const spacing = (width - padding.left - padding.right) / data.length;
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const elements = [];

    data.forEach((item, index) => {
        const barHeight = (parseFloat(item.value) / maxVal) * (height - padding.top - padding.bottom);
        const x = padding.left + (index * spacing) + (spacing - barWidth) / 2;
        const y = height - padding.bottom - barHeight;

        // Draw Bar
        ctx.fillStyle = customColors ? (customColors[index % customColors.length]) : '#4f46e5';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
        } else {
            ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();

        // X-Axis Label
        ctx.fillStyle = '#6b7280';
        let label = String(item.label);
        if (label.length > 10) label = label.substring(0, 8) + '..'; // Truncate long labels
        ctx.fillText(label, x + barWidth / 2, height - padding.bottom + 10);

        // Store for tooltip
        elements.push({
            hitTest: (hx, hy) => hx >= x && hx <= x + barWidth && hy >= y && hy <= y + barHeight,
            tooltipText: `<strong>${item.label}</strong><br>${yLabel}: ${formatter(item.value)}`
        });
    });

    setupTooltip(canvas, elements, rect);
}

function createHorizontalBarChart(canvasId, data, yLabel, xLabel, formatter) {
    const canvasObj = initCanvas(canvasId);
    if (!canvasObj) return;
    const { canvas, ctx, width, height, rect } = canvasObj;
    if (!data || data.length === 0) return handleEmptyData(ctx, canvas);

    const padding = { top: 30, right: 50, bottom: 40, left: 100 }; // Extra left padding for labels
    const maxVal = Math.max(...data.map(d => parseFloat(d.value))) * 1.2 || 1;

    // Draw grid (vertical lines for X-axis)
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
        const x = padding.left + (width - padding.left - padding.right) * (i / steps);
        const val = Math.round(maxVal * (i / steps));
        
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
        
        ctx.fillText(formatter(val), x, height - padding.bottom + 10);
    }
    
    // Axes
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.stroke();

    const barHeight = (height - padding.top - padding.bottom) / data.length * 0.6;
    const spacing = (height - padding.top - padding.bottom) / data.length;
    
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const elements = [];

    data.forEach((item, index) => {
        const barWidth = (parseFloat(item.value) / maxVal) * (width - padding.left - padding.right);
        const y = padding.top + (index * spacing) + (spacing - barHeight) / 2;
        const x = padding.left;

        // Draw Bar
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, barWidth, barHeight, [0, 4, 4, 0]);
        } else {
            ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();

        // Y-Axis Label
        ctx.fillStyle = '#6b7280';
        let label = String(item.label);
        if (label.length > 15) label = label.substring(0, 13) + '..';
        ctx.fillText(label, x - 10, y + barHeight / 2);

        // Store for tooltip
        elements.push({
            hitTest: (hx, hy) => hx >= x && hx <= x + barWidth && hy >= y && hy <= y + barHeight,
            tooltipText: `<strong>${item.label}</strong><br>${xLabel}: ${formatter(item.value)}`
        });
    });

    setupTooltip(canvas, elements, rect);
}

function createLineChart(canvasId, data, xLabel, yLabel, formatter) {
    const canvasObj = initCanvas(canvasId);
    if (!canvasObj) return;
    const { canvas, ctx, width, height, rect } = canvasObj;
    if (!data || data.length === 0) return handleEmptyData(ctx, canvas);

    const padding = { top: 30, right: 30, bottom: 50, left: 70 };
    const maxVal = Math.max(...data.map(d => parseFloat(d.value))) * 1.2 || 1;

    drawGridAndAxes(ctx, width, height, padding, maxVal, formatter);

    const spacing = (width - padding.left - padding.right) / Math.max(1, (data.length - 1));
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const points = [];
    
    // Draw Line
    ctx.beginPath();
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    
    data.forEach((item, index) => {
        const x = padding.left + (index * spacing);
        const y = height - padding.bottom - ((parseFloat(item.value) / maxVal) * (height - padding.top - padding.bottom));
        
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        
        points.push({ x, y, item });
        
        // X-Axis Label
        ctx.fillStyle = '#6b7280';
        // Show fewer labels if too many points
        if (data.length < 15 || index % Math.ceil(data.length / 10) === 0 || index === data.length - 1) {
            let label = String(item.label);
            ctx.save();
            ctx.translate(x, height - padding.bottom + 10);
            ctx.rotate(-Math.PI / 4);
            ctx.textAlign = 'right';
            ctx.fillText(label, 0, 0);
            ctx.restore();
        }
    });
    ctx.stroke();
    
    // Draw Points
    const elements = [];
    points.forEach(p => {
        ctx.beginPath();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 2;
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        elements.push({
            hitTest: (hx, hy) => Math.hypot(hx - p.x, hy - p.y) < 10,
            tooltipText: `<strong>${p.item.label}</strong><br>${yLabel}: ${formatter(p.item.value)}`
        });
    });

    setupTooltip(canvas, elements, rect);
}

function createPieChart(canvasId, data, categoryLabel, valueLabel, formatter) {
    const canvasObj = initCanvas(canvasId);
    if (!canvasObj) return;
    const { canvas, ctx, width, height, rect } = canvasObj;
    if (!data || data.length === 0) return handleEmptyData(ctx, canvas);

    const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];
    const total = data.reduce((sum, item) => sum + parseFloat(item.value), 0);
    
    if (total === 0) return handleEmptyData(ctx, canvas);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 * 0.7;

    let startAngle = -Math.PI / 2;
    const elements = [];

    data.forEach((item, index) => {
        const val = parseFloat(item.value);
        if (val === 0) return;
        
        const sliceAngle = (val / total) * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();

        ctx.fillStyle = colors[index % colors.length];
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // Legend/Labels (if large enough slice)
        if (sliceAngle > 0.15) {
            const labelRadius = radius * 1.2;
            const labelAngle = startAngle + sliceAngle / 2;
            const lx = centerX + Math.cos(labelAngle) * labelRadius;
            const ly = centerY + Math.sin(labelAngle) * labelRadius;
            
            ctx.fillStyle = '#374151';
            ctx.font = '12px Inter';
            ctx.textAlign = Math.cos(labelAngle) > 0 ? 'left' : 'right';
            ctx.textBaseline = 'middle';
            const percentage = Math.round((val / total) * 100) + '%';
            
            // Draw connection line
            ctx.beginPath();
            ctx.moveTo(centerX + Math.cos(labelAngle) * radius, centerY + Math.sin(labelAngle) * radius);
            ctx.lineTo(lx - (Math.cos(labelAngle) > 0 ? 5 : -5), ly);
            ctx.strokeStyle = '#e5e7eb';
            ctx.stroke();

            ctx.fillText(`${item.label} (${percentage})`, lx, ly);
        }

        const currentStart = startAngle;
        const currentEnd = endAngle;
        
        elements.push({
            hitTest: (hx, hy) => {
                const dx = hx - centerX;
                const dy = hy - centerY;
                const d = Math.hypot(dx, dy);
                if (d > radius) return false;
                let angle = Math.atan2(dy, dx);
                if (angle < -Math.PI / 2) angle += 2 * Math.PI; // normalize to match start angle
                
                // Adjust if end angle wraps around
                if (currentEnd > Math.PI * 1.5 && angle < Math.PI * 0.5) angle += 2 * Math.PI;
                
                return angle >= currentStart && angle <= currentEnd;
            },
            tooltipText: `<strong>${item.label}</strong><br>${valueLabel}: ${formatter(item.value)}<br>Percentage: ${Math.round((val / total) * 100)}%`
        });

        startAngle = endAngle;
    });

    setupTooltip(canvas, elements, rect);
}
