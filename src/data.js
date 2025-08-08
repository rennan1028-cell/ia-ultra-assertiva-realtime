// src/data.js - Módulo para integração com dados reais da ForexRateAPI
class ForexDataManager {
    constructor() {
        this.apiKey = '944ccf40bb789ad27f80a9325cac04f3'; // SUA CHAVE REAL!
        this.baseUrl = 'https://api.forexrateapi.com/v1';
        this.lastUpdate = 0;
        this.updateInterval = 30000; // 30 segundos
        this.rateLimitDelay = 1000; // 1 segundo entre requests
        this.cache = new Map();
        this.isConnected = false;
        this.lastRequestTime = 0;
        
        // Configuração dos pares de moedas
        this.currencyPairs = {
            'EURUSD': { base: 'EUR', quote: 'USD', decimals: 5 },
            'GBPUSD': { base: 'GBP', quote: 'USD', decimals: 5 },
            'USDJPY': { base: 'USD', quote: 'JPY', decimals: 3 },
            'AUDUSD': { base: 'AUD', quote: 'USD', decimals: 5 },
            'GBPJPY': { base: 'GBP', quote: 'JPY', decimals: 3 },
            'EURGBP': { base: 'EUR', quote: 'GBP', decimals: 5 }
        };
        
        // Dados de fallback para caso a API falhe
        this.fallbackData = {
            'EURUSD': 1.08750,
            'GBPUSD': 1.26340,
            'USDJPY': 149.235,
            'AUDUSD': 0.67890,
            'GBPJPY': 188.450,
            'EURGBP': 0.85670
        };
    }
    
    // Verificar rate limiting
    checkRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.rateLimitDelay) {
            return this.rateLimitDelay - timeSinceLastRequest;
        }
        
        return 0;
    }
    
    // Buscar dados da API com retry e fallback
    async fetchRealTimeData() {
        console.log('🌐 Buscando dados reais da ForexRateAPI...');
        
        // Verificar rate limiting
        const waitTime = this.checkRateLimit();
        if (waitTime > 0) {
            console.log(`⏱️ Aguardando ${waitTime}ms devido ao rate limit...`);
            await this.delay(waitTime);
        }
        
        try {
            this.lastRequestTime = Date.now();
            
            // Buscar taxas base USD
            const usdRates = await this.fetchWithTimeout(
                `${this.baseUrl}/latest?api_key=${this.apiKey}&base=USD&symbols=EUR,GBP,JPY,AUD,CAD`
            );
            
            // Aguardar um pouco antes da próxima request
            await this.delay(500);
            
            // Buscar taxas base EUR
            const eurRates = await this.fetchWithTimeout(
                `${this.baseUrl}/latest?api_key=${this.apiKey}&base=EUR&symbols=USD,GBP,JPY`
            );
            
            // Aguardar um pouco antes da próxima request
            await this.delay(500);
            
            // Buscar taxas base GBP
            const gbpRates = await this.fetchWithTimeout(
                `${this.baseUrl}/latest?api_key=${this.apiKey}&base=GBP&symbols=USD,JPY`
            );
            
            const processedData = this.processApiData(usdRates, eurRates, gbpRates);
            
            if (processedData) {
                this.isConnected = true;
                this.lastUpdate = Date.now();
                console.log('✅ Dados reais obtidos com sucesso!');
                return processedData;
            } else {
                throw new Error('Dados processados inválidos');
            }
            
        } catch (error) {
            console.error('❌ Erro ao buscar dados reais:', error.message);
            this.isConnected = false;
            return this.getFallbackData();
        }
    }
    
    // Fetch com timeout
    async fetchWithTimeout(url, timeout = 8000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'TradingAI/3.0'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error?.message || 'API retornou erro');
            }
            
            return data;
            
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    
    // Processar dados da API para os pares de moedas
    processApiData(usdData, eurData, gbpData) {
        try {
            const processedData = new Map();
            
            // EUR/USD
            if (eurData?.rates?.USD) {
                processedData.set('EURUSD', {
                    price: parseFloat(eurData.rates.USD),
                    symbol: 'EUR/USD',
                    decimals: 5,
                    source: 'REAL_API',
                    timestamp: Date.now()
                });
            }
            
            // GBP/USD
            if (gbpData?.rates?.USD) {
                processedData.set('GBPUSD', {
                    price: parseFloat(gbpData.rates.USD),
                    symbol: 'GBP/USD',
                    decimals: 5,
                    source: 'REAL_API',
                    timestamp: Date.now()
                });
            }
            
            // USD/JPY
            if (usdData?.rates?.JPY) {
                processedData.set('USDJPY', {
                    price: parseFloat(usdData.rates.JPY),
                    symbol: 'USD/JPY',
                    decimals: 3,
                    source: 'REAL_API',
                    timestamp: Date.now()
                });
            }
            
            // AUD/USD
            if (usdData?.rates?.AUD) {
                processedData.set('AUDUSD', {
                    price: 1 / parseFloat(usdData.rates.AUD),
                    symbol: 'AUD/USD',
                    decimals: 5,
                    source: 'REAL_API',
                    timestamp: Date.now()
                });
            }
            
            // GBP/JPY (calculado)
            if (gbpData?.rates?.JPY) {
                processedData.set('GBPJPY', {
                    price: parseFloat(gbpData.rates.JPY),
                    symbol: 'GBP/JPY',
                    decimals: 3,
                    source: 'REAL_API',
                    timestamp: Date.now()
                });
            }
            
            // EUR/GBP (calculado)
            if (eurData?.rates?.GBP) {
                processedData.set('EURGBP', {
                    price: parseFloat(eurData.rates.GBP),
                    symbol: 'EUR/GBP',
                    decimals: 5,
                    source: 'REAL_API',
                    timestamp: Date.now()
                });
            }
            
            // Adicionar variações simuladas baseadas nos preços reais
            processedData.forEach((data, pair) => {
                const previousPrice = this.cache.get(pair)?.price || data.price;
                const change = data.price - previousPrice;
                const changePercent = previousPrice > 0 ? (change / previousPrice) * 100 : 0;
                
                data.change = change;
                data.changePercent = changePercent;
                data.volume = 125000 + Math.random() * 75000; // Volume simulado
                
                this.cache.set(pair, data);
            });
            
            console.log(`📊 Processados ${processedData.size} pares de moedas reais`);
            return processedData;
            
        } catch (error) {
            console.error('❌ Erro ao processar dados da API:', error);
            return null;
        }
    }
    
    // Dados de fallback com simulação
    getFallbackData() {
        console.log('🔄 Usando dados de fallback...');
        
        const fallbackData = new Map();
        
        Object.entries(this.fallbackData).forEach(([pair, basePrice]) => {
            const cached = this.cache.get(pair);
            const lastPrice = cached?.price || basePrice;
            
            // Variação pequena baseada no preço anterior
            const variation = (Math.random() - 0.5) * 0.0015; // 0.15% max
            const newPrice = Math.max(0.1, lastPrice * (1 + variation));
            
            const change = newPrice - lastPrice;
            const changePercent = lastPrice > 0 ? (change / lastPrice) * 100 : 0;
            
            const data = {
                price: newPrice,
                symbol: this.getSymbolDisplay(pair),
                decimals: this.currencyPairs[pair]?.decimals || 5,
                change: change,
                changePercent: changePercent,
                volume: 100000 + Math.random() * 100000,
                source: 'FALLBACK_SIMULATION',
                timestamp: Date.now()
            };
            
            fallbackData.set(pair, data);
            this.cache.set(pair, data);
        });
        
        return fallbackData;
    }
    
    // Verificar se dados estão atualizados
    isDataFresh() {
        const now = Date.now();
        return (now - this.lastUpdate) < this.updateInterval;
    }
    
    // Status da conexão
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            lastUpdate: this.lastUpdate,
            dataAge: Date.now() - this.lastUpdate,
            cacheSize: this.cache.size
        };
    }
    
    // Utilitários
    getSymbolDisplay(pair) {
        const symbols = {
            'EURUSD': 'EUR/USD',
            'GBPUSD': 'GBP/USD',
            'USDJPY': 'USD/JPY',
            'AUDUSD': 'AUD/USD',
            'GBPJPY': 'GBP/JPY',
            'EURGBP': 'EUR/GBP'
        };
        return symbols[pair] || pair;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Método público para obter dados atualizados
    async getData(forceRefresh = false) {
        if (!forceRefresh && this.isDataFresh() && this.cache.size > 0) {
            console.log('📋 Usando dados do cache...');
            return new Map(this.cache);
        }
        
        return await this.fetchRealTimeData();
    }
    
    // Inicializar dados
    async initialize() {
        console.log('🚀 Inicializando ForexDataManager...');
        
        try {
            const data = await this.fetchRealTimeData();
            console.log('✅ ForexDataManager inicializado com sucesso!');
            return data;
        } catch (error) {
            console.error('❌ Erro na inicialização, usando fallback:', error.message);
            return this.getFallbackData();
        }
    }
}

// Exportar para uso global
window.ForexDataManager = ForexDataManager;