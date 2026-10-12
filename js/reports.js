const API_CANDIDATES = [
    '/api/reports',
    'http://localhost:8000/api/reports',
    'http://localhost:9007/api/reports',
    'http://localhost:9013/api/reports',
    'http://localhost:9000/api/reports'
];

let currentFilter = 'thisYear';
let dateFrom = '';
let dateTo = '';

// Create Tooltip Element
const tooltip = document.createElement('div');
tooltip.id = 'chartTooltip';
document.body.appendChild(tooltip);

document.addEventListener('DOMContentLoaded', () => {
    setupDateFilters();
    refreshReports();
});

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

async function refreshReports() {
    const loadEl = document.getElementById('loadingOverlay');
    const errEl = document.getElementById('errorOverlay');
    if (loadEl) loadEl.style.display = 'flex';
    if (errEl) errEl.style.display = 'none';

    const qs = getQueryString();
    let data = null;

    // Try all candidate endpoints with and without /all
    const endpointsToTry = [];
    for (const base of API_CANDIDATES) {
        endpointsToTry.push(`${base}/all${qs}`);
        endpointsToTry.push(`${base}${qs}`);
    }

    for (const url of endpointsToTry) {
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (response.ok) {
                const resJson = await response.json();
                if (resJson && resJson.success && resJson.data) {
                    data = resJson.data;
                    break;
                } else if (resJson && resJson.kpis) {
                    data = resJson;
                    break;
                }
            }
        } catch (e) {
            // Try next endpoint
        }
    }

    if (data) {
        try {
            updateKPIs(data.kpis || {});
            drawAllCharts(data.charts || {});
            if (errEl) errEl.style.display = 'none';
        } catch (renderErr) {
            console.error("[Reports] Render error:", renderErr);
        }
    } else {
        if (errEl) errEl.style.display = 'flex';
    }

    if (loadEl) loadEl.style.display = 'none';
}

const formatCurrency = (val) => '₹' + Math.round(parseFloat(val) || 0).toLocaleString('en-IN');
const formatNumber = (val) => Math.round(parseFloat(val) || 0).toLocaleString('en-IN');

function updateKPIs(kpis) {
    document.getElementById('kpiTotalSales').textContent = formatCurrency(kpis.totalSales || 0);
    document.getElementById('kpiTotalOrders').textContent = formatNumber(kpis.totalOrders || 0);
    document.getElementById('kpiTotalProducts').textContent = formatNumber(kpis.totalProducts || 0);
    document.getElementById('kpiTotalCustomers').textContent = formatNumber(kpis.totalCustomers || 0);
    document.getElementById('kpiTodaySales').textContent = formatCurrency(kpis.todaySales || 0);
    document.getElementById('kpiTodayOrders').textContent = formatNumber(kpis.todayOrders || 0);
    document.getElementById('kpiLowStock').textContent = formatNumber(kpis.lowStock || 0);
    document.getElementById('kpiCancelledOrders').textContent = formatNumber(kpis.cancelledOrders || 0);
}

function drawAllCharts(chartsData) {
    // 1. Sales by Category
    createBarChart('chartSalesByCategory', chartsData.salesByCategory, 'Category', 'Sales', formatCurrency);
    // 2. Sales Distribution by Category
    createPieChart('chartSalesDistribution', chartsData.salesByCategory, 'Category', 'Sales', formatCurrency);
    // 3. Monthly Sales Trend
    createLineChart('chartMonthlySales', chartsData.monthlySales, 'Month', 'Sales', formatCurrency);
    // 4. Daily Sales Trend
    createLineChart('chartDailySales', chartsData.dailySales, 'Date', 'Sales', formatCurrency);
    // 5. Top 10 Best-Selling Products
    createHorizontalBarChart('chartTopSelling', chartsData.topProducts, 'Product', 'Quantity', formatNumber);
    // 6. Product-wise Revenue
    createBarChart('chartProductRevenue', chartsData.productRevenue, 'Product', 'Revenue', formatCurrency);
    // 7. Order Status Distribution
    createPieChart('chartOrderStatus', chartsData.orderStatus, 'Status', 'Count', formatNumber);
    // 8. Payment Method Distribution
    createPieChart('chartPaymentMethod', chartsData.paymentMethod, 'Method', 'Count', formatNumber);
    // 9. Quantity Sold by Category
    createBarChart('chartQuantityByCategory', chartsData.quantityByCategory, 'Category', 'Quantity', formatNumber);
    // 10. Top 10 Customers
    createHorizontalBarChart('chartTopCustomers', chartsData.topCustomers, 'Customer', 'Orders', formatNumber);
    // 11. Stock by Category
    createBarChart('chartStockByCategory', chartsData.stockByCategory, 'Category', 'Stock', formatNumber);
    // 12. Low Stock Products
    createHorizontalBarChart('chartLowStock', chartsData.lowStockProducts, 'Product', 'Stock', formatNumber);
    // 13. Today's Sales vs Yesterday's Sales
    createBarChart('chartSalesComparison', chartsData.salesComparison, 'Day', 'Sales', formatCurrency, ['#3b82f6', '#10b981']);
    
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
        ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
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
        ctx.roundRect(x, y, barWidth, barHeight, [0, 4, 4, 0]);
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
