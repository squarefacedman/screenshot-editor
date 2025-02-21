class Editor {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.elements = [];
    this.selectedElements = new Set();
    this.isDragging = false;
    this.isResizing = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.resizeStartX = 0;
    this.resizeStartY = 0;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.resizeHandle = null;
    this.resizeStartBounds = null;
    this.isShiftPressed = false;
    this.isPainting = false;
    this.brushSize = 5;
    this.brushColor = '#000000';
    this.lastPoint = null;
    this.brushMode = false;
    
    // Set initial canvas size
    this.canvas.width = 800;
    this.canvas.height = 600;
    
    this.setupEventListeners();
    // Add font loading check
    this.loadFonts();
    
    // Initialize dark mode from localStorage or system preference
    this.initializeDarkMode();
  }

  setupEventListeners() {
    document.getElementById('imageInput').addEventListener('change', (e) => this.loadBaseImage(e));
    document.getElementById('addText').addEventListener('click', () => this.addText());
    document.getElementById('addImage').addEventListener('click', () => this.addOverlayImage());
    document.getElementById('download').addEventListener('click', () => this.downloadImage());
    document.getElementById('clear').addEventListener('click', () => this.clearElements());
    
    // Add color picker change event listener
    document.getElementById('colorPicker').addEventListener('input', (e) => this.updateSelectedTextColor(e.target.value));
    
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.brushMode) {
        this.startPainting(e);
      } else {
        this.handleMouseDown(e);
      }
    });
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.brushMode) {
        this.paint(e);
      } else {
        this.handleMouseMove(e);
      }
    });
    this.canvas.addEventListener('mouseup', () => {
      if (this.brushMode) {
        this.stopPainting();
      } else {
        this.handleMouseUp();
      }
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') {
        this.isShiftPressed = true;
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && this.selectedElements.size > 0) {
        e.preventDefault();
        this.deleteSelectedElements();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        this.isShiftPressed = false;
      }
    });
    
    // Add dark mode toggle listener
    document.getElementById('darkModeToggle').addEventListener('click', () => this.toggleDarkMode());
    
    // Add mousemove event listener for resize handles
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.updateCursor(x, y);
    });
    
    // Add border color picker and size change event listeners
    document.getElementById('borderColorPicker').addEventListener('input', (e) => this.updateSelectedTextBorder(e.target.value));
    document.getElementById('borderSize').addEventListener('input', (e) => this.updateSelectedTextBorderSize(e.target.value));
    document.getElementById('addBox').addEventListener('click', () => this.addBox());
    document.getElementById('addBlurBox').addEventListener('click', () => this.addBlurBox());
    document.getElementById('blurRadius').addEventListener('input', (e) => this.updateSelectedBlurRadius(e.target.value));
    
    document.getElementById('toggleBrush').addEventListener('click', () => this.toggleBrushMode());
    document.getElementById('brushSize').addEventListener('input', (e) => this.updateBrushSize(e.target.value));
    document.getElementById('brushColor').addEventListener('input', (e) => this.updateBrushColor(e.target.value));
    
    document.getElementById('centerX').addEventListener('click', () => this.centerSelectedOnX());
    document.getElementById('centerY').addEventListener('click', () => this.centerSelectedOnY());
    
    this.canvas.addEventListener('mouseleave', () => {
      if (this.brushMode) {
        this.stopPainting();
      }
    });
  }

  async loadBaseImage(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image'));
      });
      
      let width = img.width;
      let height = img.height;
      const maxWidth = window.innerWidth * 0.9;
      const maxHeight = window.innerHeight * 0.8;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }
      
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx.drawImage(img, 0, 0, width, height);
      this.baseImage = img;
      this.redraw();
    } catch (error) {
      console.error('Error loading image:', error);
      alert('Failed to load image. Please try again.');
    }
  }

  addText() {
    const text = prompt('Enter text:');
    if (!text?.trim()) return;
  
    const fontFamily = document.getElementById('fontSelect').value;
    const color = document.getElementById('colorPicker').value;
    const size = parseInt(document.getElementById('fontSize').value) || 20;
    const borderColor = document.getElementById('borderColorPicker').value;
    const borderSize = parseInt(document.getElementById('borderSize').value) || 0;
  
    this.elements.push({
      type: 'text',
      content: text,
      x: this.canvas.width / 4,
      y: this.canvas.height / 4,
      fontFamily: fontFamily,
      fontSize: size,
      font: `${size}px ${fontFamily}`,
      color: color,
      borderColor: borderColor,
      borderSize: borderSize
    });
  
    this.redraw();
  }

  async addOverlayImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
  
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error('Failed to load overlay image'));
        });
        
        let width = img.width;
        let height = img.height;
        const maxSize = Math.min(this.canvas.width, this.canvas.height) / 2;
        
        if (width > maxSize || height > maxSize) {
          const ratio = maxSize / Math.max(width, height);
          width *= ratio;
          height *= ratio;
        }
        
        this.elements.push({
          type: 'image',
          content: img,
          x: (this.canvas.width - width) / 2,
          y: (this.canvas.height - height) / 2,
          width: width,
          height: height
        });
        
        this.redraw();
      } catch (error) {
        console.error('Error loading overlay image:', error);
        alert('Failed to load overlay image. Please try again.');
      }
    };
  
    input.click();
  }

  addBox() {
    const color = document.getElementById('colorPicker').value;
    const borderColor = document.getElementById('borderColorPicker').value;
    const borderSize = parseInt(document.getElementById('borderSize').value) || 0;
    const boxSize = 100; // Default size for new boxes
    
    const boxConfig = {
      type: 'box',
      x: this.canvas.width / 4,
      y: this.canvas.height / 4,
      width: boxSize,
      height: boxSize,
      color: color,
      borderColor: borderColor,
      borderSize: borderSize
    };
    
    this.elements.push(boxConfig);
    this.redraw();
  }

  addBlurBox() {
    const boxSize = 100; // Default size for new boxes
    const blurRadius = parseInt(document.getElementById('blurRadius').value) || 5;
    
    this.elements.push({
      type: 'blur',
      x: this.canvas.width / 4,
      y: this.canvas.height / 4,
      width: boxSize,
      height: boxSize,
      blurRadius: blurRadius
    });
    
    this.redraw();
  }

  async loadFonts() {
    try {
      await document.fonts.ready;
      const fonts = [
        'Roboto',
        'Pacifico',
        'Press Start 2P',
        'Comic Neue',
        'Abril Fatface',
        'Dancing Script',
        'Lobster',
        'Permanent Marker',
        'Playfair Display',
        'Shadows Into Light',
        'Source Code Pro',
        'Merriweather',
        'Amatic SC',
        'Anton',
        'Architects Daughter',
        'Bangers',
        'Bebas Neue',
        'Cairo',
        'Caveat',
        'Cinzel',
        'Comfortaa',
        'Courgette',
        'Crimson Text',
        'DM Sans',
        'Dosis',
        'Edu NSW ACT Foundation',
        'Exo 2',
        'Fjalla One',
        'Great Vibes',
        'Handlee',
        'IBM Plex Sans',
        'Indie Flower',
        'Inter',
        'Josefin Sans',
        'Kanit',
        'Kalam',
        'Kaushan Script',
        'Lato',
        'League Spartan',
        'Lilita One',
        'Lora',
        'Manrope',
        'Montserrat',
        'Mukta',
        'Mulish',
        'Noto Sans',
        'Nunito',
        'Open Sans',
        'Oswald',
        'Outfit',
        'PT Sans',
        'Poppins',
        'Prompt',
        'Quicksand',
        'Raleway',
        'Righteous',
        'Roboto Condensed',
        'Roboto Mono',
        'Roboto Slab',
        'Rubik',
        'Sacramento',
        'Space Grotesk',
        'Space Mono',
        'Spectral',
        'Teko',
        'Tilt Neon',
        'Ubuntu',
        'VT323',
        'Varela Round',
        'Work Sans',
        'Yanone Kaffeesatz',
        'Ysabeau',
        'Zen Dots',
        'Aguafina Script',
        'Alegreya',
        'Alfa Slab One',
        'Allura',
        'Anonymous Pro',
        'Asap',
        'Bad Script',
        'Barlow',
        'Bitter',
        'Bungee',
        'Cabin',
        'Cardo',
        'Chakra Petch',
        'Cherry Cream Soda',
        'Courier Prime',
        'Covered By Your Grace',
        'Creepster',
        'Cuprum',
        'Days One',
        'Delius',
        'Didact Gothic',
        'Dokdo',
        'Encode Sans',
        'Fira Code',
        'Fira Sans',
        'Fredoka',
        'Geologica',
        'Gloria Hallelujah',
        'Gochi Hand',
        'Grape Nuts',
        'Heebo',
        'Hurricane',
        'JetBrains Mono',
        'Jost',
        'Khand',
        'Krona One',
        'Lexend',
        'Libre Baskerville',
        'Life Savers',
        'Londrina Solid',
        'Love Light',
        'Maven Pro',
        'Merriweather Sans',
        'Michroma',
        'Monoton',
        'Mr Dafoe',
        'Notable',
        'Nothing You Could Do',
        'Nova Square',
        'Oxygen',
        'Paytone One',
        'Plus Jakarta Sans',
        'Poiret One',
        'Prata',
        'Prosto One',
        'Questrial',
        'Rajdhani',
        'Rampart One',
        'Red Hat Display',
        'Reenie Beanie',
        'Rock Salt',
        'Russo One',
        'Sigmar',
        'Silkscreen',
        'Sriracha',
        'Staatliches',
        'Tektur',
        'Tourney',
        'Urbanist',
        'Vina Sans',
        'Wallpoet',
        'Yellowtail'
      ];
      
      fonts.forEach(font => {
        this.ctx.font = `20px "${font}"`;
        this.ctx.fillText(' ', 0, 0);
      });
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    } catch (error) {
      console.error('Error loading fonts:', error);
    }
  }

  initializeDarkMode() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
      return;
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {  
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    });
  }

  toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  }

  redraw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (this.baseImage) {
      this.ctx.drawImage(this.baseImage, 0, 0);
    }

    // Create a temporary canvas for blur effects
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(this.canvas, 0, 0);
    
    this.elements.forEach((element, index) => {
      if (element.type === 'blur') {
        // Apply blur effect
        this.ctx.save();
        this.ctx.filter = `blur(${element.blurRadius}px)`;
        this.ctx.drawImage(
          tempCanvas,
          element.x,
          element.y,
          element.width,
          element.height,
          element.x,
          element.y,
          element.width,
          element.height
        );
        this.ctx.filter = 'none';
        this.ctx.restore();
      } else if (element.type === 'box') {
        this.drawBox(element);
      } else if (element.type === 'text') {
        this.ctx.font = element.font;
        this.ctx.textBaseline = 'alphabetic'; 
        // Draw text border if borderSize > 0
        if (element.borderSize > 0) {
          this.ctx.strokeStyle = element.borderColor;
          this.ctx.lineWidth = element.borderSize;
          this.ctx.strokeText(element.content, element.x, element.y);
        }
        
        // Draw the text fill
        this.ctx.fillStyle = element.color;
        this.ctx.fillText(element.content, element.x, element.y);
      } else if (element.type === 'image') {
        this.ctx.drawImage(element.content, element.x, element.y, element.width, element.height);
      }
      
      if (this.selectedElements.has(index)) {
        this.drawSelectionBox(element);
      }
    });
  }

  drawBox(element) {
    this.ctx.save();

    // Draw the box fill
    this.ctx.fillStyle = element.color;
    this.ctx.fillRect(element.x, element.y, element.width, element.height);

    // Draw border if specified
    if (element.borderSize > 0) {
      this.ctx.strokeStyle = element.borderColor;
      this.ctx.lineWidth = element.borderSize;
      this.ctx.strokeRect(element.x, element.y, element.width, element.height);
    }

    this.ctx.restore();
  }

  drawSelectionBox(element) {
    this.ctx.strokeStyle = '#00f';
    this.ctx.lineWidth = 2;
    
    const bounds = this.getElementBounds(element);
    this.ctx.strokeRect(
      bounds.x - 2,
      bounds.y - 2,
      bounds.width + 4,
      bounds.height + 4
    );

    const handleSize = 8;
    this.ctx.fillStyle = '#fff';
    this.ctx.strokeStyle = '#00f';

    const handles = [
      { x: bounds.x, y: bounds.y },  
      { x: bounds.x + bounds.width / 2, y: bounds.y },  
      { x: bounds.x + bounds.width, y: bounds.y },  
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },  
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },  
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },  
      { x: bounds.x, y: bounds.y + bounds.height },  
      { x: bounds.x, y: bounds.y + bounds.height / 2 }  
    ];

    handles.forEach(handle => {
      this.ctx.fillRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize
      );
      this.ctx.strokeRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize
      );
    });
  }

  handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const resizeHandle = this.getResizeHandle(x, y);
    if (resizeHandle) {
      this.isResizing = true;
      this.resizeHandle = resizeHandle;
      this.resizeStartX = x;
      this.resizeStartY = y;
      const element = this.elements[resizeHandle.element];
      this.resizeStartBounds = this.getElementBounds(element);
      return;
    }

    const clickedElement = this.findElementAt(x, y);
    
    if (clickedElement !== null) {
      if (!this.isShiftPressed) {
        this.selectedElements.clear();
      }
      
      if (this.selectedElements.has(clickedElement)) {
        this.selectedElements.delete(clickedElement);
      } else {
        this.selectedElements.add(clickedElement);
      }

      this.isDragging = true;
      this.dragStartX = x;
      this.dragStartY = y;
      this.lastMouseX = x;
      this.lastMouseY = y;
    } else if (!this.isShiftPressed) {
      this.selectedElements.clear();
    }
    
    this.redraw();
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.isResizing) {
      const dx = x - this.resizeStartX;
      const dy = y - this.resizeStartY;
      const element = this.elements[this.resizeHandle.element];
      const bounds = this.resizeStartBounds;

      switch (this.resizeHandle.position) {
        case 'nw':
          this.resizeElement(element, bounds.x + dx, bounds.y + dy, bounds.width - dx, bounds.height - dy);
          break;
        case 'n':
          this.resizeElement(element, bounds.x, bounds.y + dy, bounds.width, bounds.height - dy);
          break;
        case 'ne':
          this.resizeElement(element, bounds.x, bounds.y + dy, bounds.width + dx, bounds.height - dy);
          break;
        case 'e':
          this.resizeElement(element, bounds.x, bounds.y, bounds.width + dx, bounds.height);
          break;
        case 'se':
          this.resizeElement(element, bounds.x, bounds.y, bounds.width + dx, bounds.height + dy);
          break;
        case 's':
          this.resizeElement(element, bounds.x, bounds.y, bounds.width, bounds.height + dy);
          break;
        case 'sw':
          this.resizeElement(element, bounds.x + dx, bounds.y, bounds.width - dx, bounds.height + dy);
          break;
        case 'w':
          this.resizeElement(element, bounds.x + dx, bounds.y, bounds.width - dx, bounds.height);
          break;
      }
      this.redraw();
      return;
    }

    if (this.isDragging) {
      const dx = x - this.lastMouseX;
      const dy = y - this.lastMouseY;
      
      for (const index of this.selectedElements) {
        this.elements[index].x += dx;
        this.elements[index].y += dy;
      }
      
      this.lastMouseX = x;
      this.lastMouseY = y;
      
      this.redraw();
    }
  }

  resizeElement(element, x, y, width, height) {
    const minSize = 10;
    width = Math.max(width, minSize);
    height = Math.max(height, minSize);

    if (element.type === 'box') {
      element.x = x;
      element.y = y;
      element.width = width;
      element.height = height;
    } else if (element.type === 'image') {
      element.x = x;
      element.y = y;
      element.width = width;
      element.height = height;
    } else if (element.type === 'text') {
      element.x = x;
      element.y = y + height; 
      element.fontSize = height;
      element.font = `${height}px ${element.fontFamily}`;
    } else if (element.type === 'blur') {
      element.x = x;
      element.y = y;
      element.width = width;
      element.height = height;
    }
  }

  getElementBounds(element) {
    if (element.type === 'box') {
      return {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height
      };
    } else if (element.type === 'text') {
      this.ctx.font = element.font;
      const metrics = this.ctx.measureText(element.content);
      const height = parseInt(element.fontSize);
      
      const actualHeight = height;
      return {
        x: element.x,
        y: element.y - actualHeight, 
        width: metrics.width,
        height: actualHeight
      };
    } else if (element.type === 'image') {
      return {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height
      };
    } else if (element.type === 'blur') {
      return {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height
      };
    }
  }

  findElementAt(x, y) {
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const element = this.elements[i];
      const bounds = this.getElementBounds(element);
      
      if (
        x >= bounds.x &&
        x <= bounds.x + bounds.width &&
        y >= bounds.y &&
        y <= bounds.y + bounds.height
      ) {
        return i;
      }
    }
    return null;
  }

  handleMouseUp() {
    this.isDragging = false;
    this.isResizing = false;
  }

  updateCursor(x, y) {
    const resizeHandle = this.getResizeHandle(x, y);
    if (resizeHandle) {
      switch (resizeHandle.position) {
        case 'nw': case 'se': this.canvas.style.cursor = 'nw-resize'; break;
        case 'ne': case 'sw': this.canvas.style.cursor = 'ne-resize'; break;
        case 'n': case 's': this.canvas.style.cursor = 'n-resize'; break;
        case 'e': case 'w': this.canvas.style.cursor = 'e-resize'; break;
      }
    } else if (this.findElementAt(x, y) !== null) {
      this.canvas.style.cursor = 'move';
    } else {
      this.canvas.style.cursor = 'default';
    }
  }

  getResizeHandle(x, y) {
    const handleSize = 8;
    for (const index of this.selectedElements) {
      const element = this.elements[index];
      const bounds = this.getElementBounds(element);
      
      const handles = [
        { x: bounds.x, y: bounds.y, position: 'nw' },
        { x: bounds.x + bounds.width / 2, y: bounds.y, position: 'n' },
        { x: bounds.x + bounds.width, y: bounds.y, position: 'ne' },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, position: 'e' },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height, position: 'se' },
        { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, position: 's' },
        { x: bounds.x, y: bounds.y + bounds.height, position: 'sw' },
        { x: bounds.x, y: bounds.y + bounds.height / 2, position: 'w' }
      ];

      for (const handle of handles) {
        if (Math.abs(x - handle.x) <= handleSize / 2 && Math.abs(y - handle.y) <= handleSize / 2) {
          return { element: index, position: handle.position };
        }
      }
    }
    return null;
  }

  deleteSelectedElements() {
    const selectedIndices = Array.from(this.selectedElements).sort((a, b) => b - a);
    
    for (const index of selectedIndices) {
      this.elements.splice(index, 1);
    }
    
    this.selectedElements.clear();
    
    this.redraw();
  }

  downloadImage() {
    try {
      const selectedElements = new Set(this.selectedElements);
      this.selectedElements.clear();
      this.redraw();
      
      const link = document.createElement('a');
      link.download = 'edited-image.png';
      link.href = this.canvas.toDataURL('image/png');
      link.click();
      
      this.selectedElements = selectedElements;
      this.redraw();
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Failed to download image. Please try again.');
    }
  }

  updateSelectedTextColor(newColor) {
    let updated = false;
    for (const index of this.selectedElements) {
      const element = this.elements[index];
      if (element.type === 'text') {
        element.color = newColor;
        updated = true;
      } else if (element.type === 'box') {
        element.color = newColor;
        updated = true;
      }
    }
    if (updated) {
      this.redraw();
    }
  }

  updateSelectedTextBorder(newColor) {
    let updated = false;
    for (const index of this.selectedElements) {
      const element = this.elements[index];
      if (element.type === 'text' || element.type === 'box') {
        element.borderColor = newColor;
        if (element.borderSize === 0) {
          element.borderSize = 1;
          document.getElementById('borderSize').value = 1;
        }
        updated = true;
      }
    }
    if (updated) {
      this.redraw();
    }
  }

  updateSelectedTextBorderSize(newSize) {
    let updated = false;
    for (const index of this.selectedElements) {
      const element = this.elements[index];
      if (element.type === 'text' || element.type === 'box') {
        element.borderSize = parseInt(newSize) || 0;
        updated = true;
      }
    }
    if (updated) {
      this.redraw();
    }
  }

  updateSelectedBlurRadius(newRadius) {
    let updated = false;
    for (const index of this.selectedElements) {
      const element = this.elements[index];
      if (element.type === 'blur') {
        element.blurRadius = parseInt(newRadius) || 0;
        updated = true;
      }
    }
    if (updated) {
      this.redraw();
    }
  }

  clearElements() {
    if (this.elements.length === 0 && !this.baseImage) return;
    
    if (confirm('Are you sure you want to clear everything?')) {
      this.elements = [];
      this.selectedElements.clear();
      this.baseImage = null; // Clear the base image
      this.redraw();
    }
  }

  toggleBrushMode() {
    this.brushMode = !this.brushMode;
    document.getElementById('toggleBrush').classList.toggle('active');
    this.canvas.style.cursor = this.brushMode ? 'crosshair' : 'default';
  }

  updateBrushSize(size) {
    this.brushSize = parseInt(size);
  }

  updateBrushColor(color) {
    this.brushColor = color;
  }

  startPainting(e) {
    this.isPainting = true;
    const rect = this.canvas.getBoundingClientRect();
    this.lastPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  paint(e) {
    if (!this.isPainting || !this.brushMode) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const currentPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = this.brushColor;
    this.ctx.lineWidth = this.brushSize;
    
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
    this.ctx.lineTo(currentPoint.x, currentPoint.y);
    this.ctx.stroke();
    
    this.lastPoint = currentPoint;
  }

  stopPainting() {
    this.isPainting = false;
  }

  centerSelectedOnX() {
    if (this.selectedElements.size === 0) return;
    
    for (const index of this.selectedElements) {
      const element = this.elements[index];
      const bounds = this.getElementBounds(element);
      const canvasCenterX = this.canvas.width / 2;
      const elementCenterX = bounds.width / 2;
      
      element.x = canvasCenterX - elementCenterX;
    }
    
    this.redraw();
  }

  centerSelectedOnY() {
    if (this.selectedElements.size === 0) return;
    
    for (const index of this.selectedElements) {
      const element = this.elements[index];
      const bounds = this.getElementBounds(element);
      const canvasCenterY = this.canvas.height / 2;
      
      if (element.type === 'text') {
        // For text, we need to account for the baseline
        element.y = canvasCenterY + bounds.height / 2;
      } else {
        // For other elements, center based on height
        element.y = canvasCenterY - bounds.height / 2;
      }
    }
    
    this.redraw();
  }

}

new Editor();