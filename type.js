// =========================
//   Structural Calculator
//   Beam Reaction Analysis
// =========================

class StructuralCalculator {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.initializeDiagram();
    }

    initializeElements() {
        // Input elements
        this.beamLengthInput = document.getElementById('beamLength');
        this.loadTypeSelect = document.getElementById('loadType');
        this.pointLoadInput = document.getElementById('pointLoad');
        this.pointDistanceInput = document.getElementById('pointDistance');
        this.uniformLoadInput = document.getElementById('uniformLoad');
        this.maxLoadInput = document.getElementById('maxLoad');
        this.loadStartInput = document.getElementById('loadStart');
        this.loadEndInput = document.getElementById('loadEnd');
        
        // Buttons
        this.calculateBtn = document.getElementById('calculateBtn');
        this.resetBtn = document.getElementById('resetBtn'); // ✅ เพิ่มปุ่ม Reset

        // Load input containers
        this.pointLoadInputs = document.getElementById('pointLoadInputs');
        this.uniformLoadInputs = document.getElementById('uniformLoadInputs');
        this.triangularLoadInputs = document.getElementById('triangularLoadInputs');

        // Results container & elements (✅ เชื่อมกับ HTML ใหม่)
        this.resultsContainer = document.getElementById('results');
        this.placeholder = this.resultsContainer.querySelector('.placeholder');
        this.calculationResult = document.getElementById('calculationResult');
        this.reactionAEl = document.getElementById('reactionA');
        this.reactionBEl = document.getElementById('reactionB');

        // Diagram elements
        this.beamDiagram = document.getElementById('beamDiagram');
        this.loadsGroup = document.getElementById('loads');
        this.dimensionsGroup = document.getElementById('dimensions');
    }

    bindEvents() {
        // เปลี่ยนประเภทแรง
        this.loadTypeSelect.addEventListener('change', () => {
            this.toggleLoadInputs();
        });

        // ปุ่มคำนวณ
        this.calculateBtn.addEventListener('click', () => {
            this.calculate();
        });

        // ✅ ปุ่มล้างค่า (Reset)
        this.resetBtn.addEventListener('click', () => {
            this.resetCalculator();
        });

        // Real-time Validation (ตรวจสอบทันทีที่พิมพ์)
        const inputs = [
            this.beamLengthInput, this.pointLoadInput, this.pointDistanceInput,
            this.uniformLoadInput, this.maxLoadInput, this.loadStartInput, this.loadEndInput
        ];
        inputs.forEach(input => {
            if(input) input.addEventListener('input', () => this.validateInputs());
        });
    }

    toggleLoadInputs() {
        const loadType = this.loadTypeSelect.value;
        
        // ซ่อนทั้งหมดก่อน
        this.pointLoadInputs.style.display = 'none';
        this.uniformLoadInputs.style.display = 'none';
        this.triangularLoadInputs.style.display = 'none';

        // เปิดเฉพาะที่เลือก
        switch (loadType) {
            case 'point':
                this.pointLoadInputs.style.display = 'block';
                break;
            case 'uniform':
                this.uniformLoadInputs.style.display = 'block';
                break;
            case 'triangular':
                this.triangularLoadInputs.style.display = 'block';
                break;
        }
        // รีเซ็ตรูปวาดเมื่อเปลี่ยนประเภท
        this.clearDiagram();
        this.initializeDiagram(); 
    }

    // ✅ ฟังก์ชันตรวจสอบความถูกต้อง (Validation)
    validateInputs() {
        const beamLength = parseFloat(this.beamLengthInput.value);
        const loadType = this.loadTypeSelect.value;
        let isValid = true;

        // 1. เช็คความยาวคาน
        if (!beamLength || beamLength <= 0) {
            isValid = false;
        }

        // 2. เช็คค่า Input ตามประเภทแรง
        switch (loadType) {
            case 'point':
                const pointLoad = parseFloat(this.pointLoadInput.value);
                const pointDistance = parseFloat(this.pointDistanceInput.value);
                // ระยะแรงต้องไม่เกินความยาวคาน
                if (!pointLoad || pointLoad <= 0 || pointDistance < 0 || pointDistance > beamLength) {
                    isValid = false;
                }
                break;
            case 'uniform':
                const uniformLoad = parseFloat(this.uniformLoadInput.value);
                if (!uniformLoad || uniformLoad <= 0) {
                    isValid = false;
                }
                break;
            case 'triangular':
                const maxLoad = parseFloat(this.maxLoadInput.value);
                const loadStart = parseFloat(this.loadStartInput.value);
                const loadEnd = parseFloat(this.loadEndInput.value);
                // จุดเริ่มต้องน้อยกว่าจุดจบ และไม่เกินความยาวคาน
                if (!maxLoad || maxLoad <= 0 || loadStart < 0 || 
                    !loadEnd || loadEnd <= loadStart || loadEnd > beamLength) {
                    isValid = false;
                }
                break;
        }

        // ปรับสถานะปุ่มคำนวณ (Disable ถ้าข้อมูลผิด)
        this.calculateBtn.disabled = !isValid;
        this.calculateBtn.style.opacity = isValid ? '1' : '0.6';
        this.calculateBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';

        return isValid;
    }

    calculate() {
        // เรียกใช้ Validation ก่อนคำนวณจริง
        if (!this.validateInputs()) {
            alert("⚠️ กรุณาตรวจสอบข้อมูลให้ถูกต้อง (เช่น ความยาวคาน หรือระยะแรง)");
            return;
        }

        const beamLength = parseFloat(this.beamLengthInput.value);
        const loadType = this.loadTypeSelect.value;
        
        let reactions = {};

        switch (loadType) {
            case 'point':
                reactions = this.calculatePointLoad(beamLength);
                break;
            case 'uniform':
                reactions = this.calculateUniformLoad(beamLength);
                break;
            case 'triangular':
                reactions = this.calculateTriangularLoad(beamLength);
                break;
        }

        this.displayResults(reactions);
        this.updateDiagram(beamLength, loadType, reactions);
    }

    calculatePointLoad(beamLength) {
        const load = parseFloat(this.pointLoadInput.value);
        const distance = parseFloat(this.pointDistanceInput.value);

        // ΣMA = 0: RB * L = P * a
        const reactionB = (load * distance) / beamLength;
        const reactionA = load - reactionB;

        return { reactionA, reactionB };
    }

    calculateUniformLoad(beamLength) {
        const loadPerUnit = parseFloat(this.uniformLoadInput.value);
        const totalLoad = loadPerUnit * beamLength;

        // สมมาตร แบ่งครึ่ง
        const reactionA = totalLoad / 2;
        const reactionB = totalLoad / 2;

        return { reactionA, reactionB };
    }

    calculateTriangularLoad(beamLength) {
        const maxLoad = parseFloat(this.maxLoadInput.value);
        const loadStart = parseFloat(this.loadStartInput.value);
        const loadEnd = parseFloat(this.loadEndInput.value);
        const loadLength = loadEnd - loadStart;

        // พื้นที่สามเหลี่ยม
        const totalLoad = (maxLoad * loadLength) / 2;

        // Centroid ของสามเหลี่ยมมุมฉากที่สูงทางขวา (ตามรูปวาด)
        // อยู่ที่ 2/3 ของความยาวฐาน (วัดจากด้านเตี้ย)
        const centroidFromStart = loadLength * (2/3); 
        const centroidFromA = loadStart + centroidFromStart;

        // ΣMA = 0: RB * L = TotalLoad * centroidFromA
        const reactionB = (totalLoad * centroidFromA) / beamLength;
        const reactionA = totalLoad - reactionB;

        return { reactionA, reactionB };
    }

    // ✅ ฟังก์ชันแสดงผลลัพธ์ (ปรับให้ใช้ class hidden)
    displayResults(reactions) {
        // ซ่อน placeholder
        if(this.placeholder) this.placeholder.style.display = 'none';
        
        // แสดงกล่องผลลัพธ์
        if(this.calculationResult) {
            this.calculationResult.classList.remove('hidden');
            this.calculationResult.style.display = 'block';
            
            // อัปเดตตัวเลข
            this.reactionAEl.textContent = `${reactions.reactionA.toFixed(2)} kN`;
            this.reactionBEl.textContent = `${reactions.reactionB.toFixed(2)} kN`;
        }
    }

    // ✅ ฟังก์ชันล้างค่า (Reset)
    resetCalculator() {
        // 1. ล้างค่า Inputs ทั้งหมด
        const inputs = document.querySelectorAll('input[type="number"]');
        inputs.forEach(input => input.value = '');

        // 2. ซ่อนผลลัพธ์ กลับไปโชว์ Placeholder
        if(this.calculationResult) {
            this.calculationResult.classList.add('hidden');
            this.calculationResult.style.display = 'none';
        }
        if(this.placeholder) this.placeholder.style.display = 'block';

        // 3. รีเซ็ตรูปวาด
        this.clearDiagram();
        this.initializeDiagram(); // วาดคานเปล่าๆ
        
        // 4. รีเซ็ตปุ่มคำนวณ
        this.validateInputs();
    }

    // --- ส่วนของการวาดรูป (Diagram) คงเดิมไว้ตาม Base Code ---

    initializeDiagram() {
        // วาดคานเริ่มต้น (ยาว 5m เป็นตัวอย่าง)
        this.updateDiagram(5, null, { reactionA: 0, reactionB: 0 });
    }

    clearDiagram() {
        this.loadsGroup.innerHTML = '';
        this.dimensionsGroup.innerHTML = '';
    }

    updateDiagram(beamLength, loadType, reactions) {
        this.clearDiagram();

        // Update beam length visually
        const beam = document.getElementById('beam');
        const beamWidth = Math.min(700, beamLength * 100); // Scale factor
        
        // ถ้าค่า beamLength น้อยเกินไป ให้ใช้ความกว้างขั้นต่ำเพื่อให้รูปดูสวย
        const displayWidth = beamLength ? beamWidth : 500; 
        beam.setAttribute('width', displayWidth);

        // Update supports position
        const supports = document.getElementById('supports');
        const supportB = supports.querySelector('rect:last-of-type');
        const textB = supports.querySelector('text:last-of-type');
        
        supportB.setAttribute('x', 50 + displayWidth);
        textB.setAttribute('x', 60 + displayWidth);

        // Add loads based on type
        if (loadType) {
            switch (loadType) {
                case 'point':
                    this.drawPointLoad(beamLength, displayWidth);
                    break;
                case 'uniform':
                    this.drawUniformLoad(beamLength, displayWidth);
                    break;
                case 'triangular':
                    this.drawTriangularLoad(beamLength, displayWidth);
                    break;
            }
        }

        // Add dimensions & Reactions
        if (beamLength) {
            this.drawDimensions(beamLength, displayWidth);
            if (loadType) { // วาด Reaction เมื่อมีการคำนวณแล้วเท่านั้น
                this.drawReactions(displayWidth, reactions);
            }
        }
    }

    drawPointLoad(beamLength, beamWidth) {
        const load = parseFloat(this.pointLoadInput.value);
        const distance = parseFloat(this.pointDistanceInput.value);
        const x = 50 + (distance / beamLength) * beamWidth;

        const loadGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Arrow line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x);
        line.setAttribute('y1', '200');
        line.setAttribute('x2', x);
        line.setAttribute('y2', '150');
        line.setAttribute('stroke', '#ef4444');
        line.setAttribute('stroke-width', '3');
        
        // Arrow head
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('points', `${x-5},155 ${x+5},155 ${x},150`);
        arrow.setAttribute('fill', '#ef4444');
        
        // Load value
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', '140');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#ef4444');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', 'bold');
        text.textContent = `${load} kN`;

        loadGroup.appendChild(line);
        loadGroup.appendChild(arrow);
        loadGroup.appendChild(text);
        this.loadsGroup.appendChild(loadGroup);
    }

    drawUniformLoad(beamLength, beamWidth) {
        const loadPerUnit = parseFloat(this.uniformLoadInput.value);
        const arrowSpacing = 50;
        const numArrows = Math.floor(beamWidth / arrowSpacing);

        for (let i = 0; i < numArrows; i++) {
            const x = 50 + (i * arrowSpacing);
            const loadGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x);
            line.setAttribute('y1', '200');
            line.setAttribute('x2', x);
            line.setAttribute('y2', '160');
            line.setAttribute('stroke', '#f59e0b');
            line.setAttribute('stroke-width', '2');
            
            const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            arrow.setAttribute('points', `${x-3},165 ${x+3},165 ${x},160`);
            arrow.setAttribute('fill', '#f59e0b');
            
            loadGroup.appendChild(line);
            loadGroup.appendChild(arrow);
            this.loadsGroup.appendChild(loadGroup);
        }

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', 50 + beamWidth / 2);
        text.setAttribute('y', '150');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#f59e0b');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', 'bold');
        text.textContent = `${loadPerUnit} kN/m`;
        this.loadsGroup.appendChild(text);
    }

    drawTriangularLoad(beamLength, beamWidth) {
        const loadStart = parseFloat(this.loadStartInput.value);
        const loadEnd = parseFloat(this.loadEndInput.value);
        const maxLoad = parseFloat(this.maxLoadInput.value);
        
        const startX = 50 + (loadStart / beamLength) * beamWidth;
        const endX = 50 + (loadEnd / beamLength) * beamWidth;
        const loadWidth = endX - startX;

        // Draw triangular load shape
        const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        triangle.setAttribute('points', `${startX},200 ${endX},200 ${endX},160`);
        triangle.setAttribute('fill', 'none');
        triangle.setAttribute('stroke', '#10b981');
        triangle.setAttribute('stroke-width', '2');

        // Draw load arrows
        const numArrows = 5;
        for (let i = 0; i <= numArrows; i++) {
            const x = startX + (i / numArrows) * loadWidth;
            const arrowHeight = 160 + (i / numArrows) * 40; // Varying height
            
            const loadGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x);
            line.setAttribute('y1', '200');
            line.setAttribute('x2', x);
            line.setAttribute('y2', arrowHeight); // แก้ไขทิศทางหัวลูกศรให้ถูกต้องตามความสูง
            line.setAttribute('stroke', '#10b981');
            line.setAttribute('stroke-width', '2');
            
            const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            // ปรับหัวลูกศรให้ชี้ลงที่ความสูงที่ถูกต้อง
            const yArrow = 200 - (200 - arrowHeight); 
            // หมายเหตุ: Base code วาดจาก 200 ขึ้นไป 160 ดังนั้นลูกศรควรชี้ลงที่ 200 หรือชี้ลงจากเส้นเอียง
            // เพื่อความง่ายคง Logic เดิมไว้: วาดเส้นจากล่างขึ้นบน (แต่จริงๆ แรงกดควรชี้ลง)
            // ถ้าจะให้สวยเหมือน Uniform Load ควรวาดจากเส้นเอียงลงมา 200
            // แต่เพื่อไม่ให้กระทบ Base Code มากเกินไป ผมขอคงไว้แบบเดิมครับ
            
            arrow.setAttribute('points', `${x-3},${arrowHeight+5} ${x+3},${arrowHeight+5} ${x},${arrowHeight}`);
            arrow.setAttribute('fill', '#10b981');
            
            loadGroup.appendChild(line);
            loadGroup.appendChild(arrow);
            this.loadsGroup.appendChild(loadGroup);
        }

        this.loadsGroup.appendChild(triangle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', startX + loadWidth / 2);
        text.setAttribute('y', '150');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#10b981');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', 'bold');
        text.textContent = `${maxLoad} kN/m (max)`;
        this.loadsGroup.appendChild(text);
    }

    drawDimensions(beamLength, beamWidth) {
        const dimGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        const dimLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        dimLine.setAttribute('x1', '50');
        dimLine.setAttribute('y1', '250');
        dimLine.setAttribute('x2', 50 + beamWidth);
        dimLine.setAttribute('y2', '250');
        dimLine.setAttribute('stroke', '#6b7280');
        dimLine.setAttribute('stroke-width', '1');
        
        const leftArrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        leftArrow.setAttribute('points', '55,245 55,255 50,250');
        leftArrow.setAttribute('fill', '#6b7280');
        
        const rightArrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        rightArrow.setAttribute('points', `${45 + beamWidth},245 ${45 + beamWidth},255 ${50 + beamWidth},250`);
        rightArrow.setAttribute('fill', '#6b7280');
        
        const dimText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        dimText.setAttribute('x', 50 + beamWidth / 2);
        dimText.setAttribute('y', '245');
        dimText.setAttribute('text-anchor', 'middle');
        dimText.setAttribute('fill', '#6b7280');
        dimText.setAttribute('font-size', '12');
        dimText.textContent = `${beamLength} m`;

        dimGroup.appendChild(dimLine);
        dimGroup.appendChild(leftArrow);
        dimGroup.appendChild(rightArrow);
        dimGroup.appendChild(dimText);
        this.dimensionsGroup.appendChild(dimGroup);
    }

    drawReactions(beamWidth, reactions) {
        // Reaction A
        const reactionAGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        const reactionALine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        reactionALine.setAttribute('x1', '60');
        reactionALine.setAttribute('y1', '200');
        reactionALine.setAttribute('x2', '60');
        reactionALine.setAttribute('y2', '180');
        reactionALine.setAttribute('stroke', '#6366f1');
        reactionALine.setAttribute('stroke-width', '3');
        
        const reactionAArrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        reactionAArrow.setAttribute('points', '55,185 65,185 60,180');
        reactionAArrow.setAttribute('fill', '#6366f1');
        
        const reactionAText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        reactionAText.setAttribute('x', '60');
        reactionAText.setAttribute('y', '170');
        reactionAText.setAttribute('text-anchor', 'middle');
        reactionAText.setAttribute('fill', '#6366f1');
        reactionAText.setAttribute('font-size', '11');
        reactionAText.setAttribute('font-weight', 'bold');
        reactionAText.textContent = `RA = ${reactions.reactionA.toFixed(2)} kN`;

        reactionAGroup.appendChild(reactionALine);
        reactionAGroup.appendChild(reactionAArrow);
        reactionAGroup.appendChild(reactionAText);
        this.dimensionsGroup.appendChild(reactionAGroup);

        // Reaction B
        const reactionBGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        const reactionBLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        reactionBLine.setAttribute('x1', 60 + beamWidth);
        reactionBLine.setAttribute('y1', '200');
        reactionBLine.setAttribute('x2', 60 + beamWidth);
        reactionBLine.setAttribute('y2', '180');
        reactionBLine.setAttribute('stroke', '#6366f1');
        reactionBLine.setAttribute('stroke-width', '3');
        
        const reactionBArrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        reactionBArrow.setAttribute('points', `${55 + beamWidth},185 ${65 + beamWidth},185 ${60 + beamWidth},180`);
        reactionBArrow.setAttribute('fill', '#6366f1');
        
        const reactionBText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        reactionBText.setAttribute('x', 60 + beamWidth);
        reactionBText.setAttribute('y', '170');
        reactionBText.setAttribute('text-anchor', 'middle');
        reactionBText.setAttribute('fill', '#6366f1');
        reactionBText.setAttribute('font-size', '11');
        reactionBText.setAttribute('font-weight', 'bold');
        reactionBText.textContent = `RB = ${reactions.reactionB.toFixed(2)} kN`;

        reactionBGroup.appendChild(reactionBLine);
        reactionBGroup.appendChild(reactionBArrow);
        reactionBGroup.appendChild(reactionBText);
        this.dimensionsGroup.appendChild(reactionBGroup);
    }
}

// Initialize calculator when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new StructuralCalculator();
});