# System Architecture - eTIMS OSCU Integration

## High-Level Architecture

```mermaid
graph TB
    subgraph "POS Systems"
        POS1[POS Terminal 1]
        POS2[POS Terminal 2]
        POS3[ERP System]
    end

    subgraph "Django eTIMS Middleware"
        API[Django REST API]
        AUTH[Authentication Layer]
        SERIALIZER[Request Serializers]
        BUSINESS[Business Logic Layer]
        KRA_CLIENT[KRA Client Service]
        PAYLOAD[Payload Builder]
        CELERY[Celery Workers]
        REDIS[Redis Queue]
    end

    subgraph "Data Layer"
        POSTGRES[(PostgreSQL Database)]
        LOGS[API Logs]
        CACHE[Redis Cache]
    end

    subgraph "KRA eTIMS"
        OSCU[OSCU API Endpoint]
        VSCU[VSCU Validation]
        KRA_DB[(KRA Database)]
    end

    subgraph "External Services"
        MONITOR[Monitoring/Alerts]
        BACKUP[Backup Service]
    end

    %% Data Flow
    POS1 --> API
    POS2 --> API
    POS3 --> API
    
    API --> AUTH
    AUTH --> SERIALIZER
    SERIALIZER --> BUSINESS
    BUSINESS --> KRA_CLIENT
    KRA_CLIENT --> PAYLOAD
    PAYLOAD --> OSCU
    
    BUSINESS --> POSTGRES
    API --> LOGS
    CELERY --> REDIS
    CELERY --> KRA_CLIENT
    
    OSCU --> VSCU
    VSCU --> KRA_DB
    
    POSTGRES --> BACKUP
    API --> MONITOR
```

## Component Details

### 1. API Gateway Layer
- **Django REST Framework**: Main API endpoints
- **Authentication**: Token-based auth for POS systems
- **Rate Limiting**: Prevent API abuse
- **CORS**: Cross-origin request handling

### 2. Business Logic Layer
- **Device Management**: Registration and CMC key handling
- **Invoice Processing**: Sales transaction validation
- **Item Management**: Product catalog synchronization
- **Error Handling**: Retry logic and failure management

### 3. KRA Integration Layer
- **KRA Client Service**: HTTP client for OSCU API
- **Payload Builder**: XML/JSON formatting per KRA specs
- **Signature Handling**: Receipt signature processing
- **Connection Management**: Timeout and retry handling

### 4. Async Processing Layer
- **Celery Workers**: Background task processing
- **Redis Queue**: Task queue management
- **Retry Logic**: Exponential backoff for failed requests
- **Monitoring**: Task status tracking

## Data Flow Diagrams

### Device Registration Flow

```mermaid
sequenceDiagram
    participant POS as POS System
    participant API as Django API
    participant KRA as KRA OSCU
    participant DB as PostgreSQL

    POS->>API: POST /api/device/init/
    API->>DB: Create Device record
    API->>KRA: POST /selectInitOsdcInfo
    KRA->>API: Return CMC Key
    API->>DB: Update Device with CMC Key
    API->>POS: Return success + device_id
```

### Sales Transaction Flow

```mermaid
sequenceDiagram
    participant POS as POS System
    participant API as Django API
    participant CELERY as Celery Worker
    participant KRA as KRA OSCU
    participant DB as PostgreSQL

    POS->>API: POST /api/sales/
    API->>DB: Create Invoice + Items
    API->>KRA: POST /saveTrnsSalesOsdc
    
    alt Success
        KRA->>API: Return receipt signature
        API->>DB: Update invoice with signature
        API->>POS: Return signed receipt
    else Failure
        KRA->>API: Return error
        API->>CELERY: Queue retry task
        API->>POS: Return temporary receipt
        CELERY->>KRA: Retry request (async)
    end
```

### Error Handling & Retry Flow

```mermaid
flowchart TD
    START[Sales Request] --> VALIDATE[Validate Request]
    VALIDATE --> SEND[Send to KRA]
    SEND --> SUCCESS{KRA Success?}
    
    SUCCESS -->|Yes| STORE[Store Signature]
    SUCCESS -->|No| CHECK_ERROR{Retryable Error?}
    
    CHECK_ERROR -->|Yes| QUEUE[Add to Retry Queue]
    CHECK_ERROR -->|No| FAIL[Mark as Failed]
    
    QUEUE --> CELERY[Celery Worker]
    CELERY --> WAIT[Wait with Backoff]
    WAIT --> RETRY[Retry Request]
    RETRY --> RETRY_SUCCESS{Success?}
    
    RETRY_SUCCESS -->|Yes| STORE
    RETRY_SUCCESS -->|No| COUNT{Max Retries?}
    
    COUNT -->|No| QUEUE
    COUNT -->|Yes| FAIL
    
    STORE --> RETURN[Return to POS]
    FAIL --> ALERT[Send Alert]
    ALERT --> RETURN
```

## Security Architecture

### Authentication & Authorization
- **API Keys**: Unique keys per POS system
- **Token Authentication**: JWT tokens for session management
- **IP Whitelisting**: Restrict access by IP ranges
- **Rate Limiting**: Prevent abuse and DoS attacks

### Data Security
- **Encryption at Rest**: Database encryption
- **Encryption in Transit**: HTTPS/TLS for all communications
- **Key Management**: Secure storage of CMC keys
- **Audit Logging**: Complete audit trail of all operations

### KRA Communication Security
- **Certificate Validation**: Verify KRA SSL certificates
- **Request Signing**: Digital signatures for critical requests
- **Timeout Management**: Prevent hanging connections
- **Error Sanitization**: Clean error messages for logs

## Scalability Considerations

### Horizontal Scaling
- **Load Balancer**: Distribute requests across multiple Django instances
- **Database Sharding**: Partition data by device/branch
- **Redis Clustering**: Scale queue processing
- **CDN Integration**: Cache static content

### Performance Optimization
- **Database Indexing**: Optimize query performance
- **Connection Pooling**: Efficient database connections
- **Caching Strategy**: Redis for frequently accessed data
- **Async Processing**: Non-blocking operations

### Monitoring & Observability
- **Health Checks**: System status monitoring
- **Metrics Collection**: Performance and business metrics
- **Log Aggregation**: Centralized logging
- **Alerting**: Real-time error notifications

## Deployment Architecture

### Production Environment
```mermaid
graph TB
    subgraph "Load Balancer"
        LB[Nginx/HAProxy]
    end
    
    subgraph "Application Servers"
        APP1[Django Instance 1]
        APP2[Django Instance 2]
        APP3[Django Instance 3]
    end
    
    subgraph "Background Workers"
        WORKER1[Celery Worker 1]
        WORKER2[Celery Worker 2]
    end
    
    subgraph "Data Layer"
        DB_MASTER[(PostgreSQL Master)]
        DB_REPLICA[(PostgreSQL Replica)]
        REDIS_CLUSTER[Redis Cluster]
    end
    
    subgraph "Monitoring"
        PROMETHEUS[Prometheus]
        GRAFANA[Grafana]
        ALERTS[AlertManager]
    end
    
    LB --> APP1
    LB --> APP2
    LB --> APP3
    
    APP1 --> DB_MASTER
    APP2 --> DB_MASTER
    APP3 --> DB_MASTER
    
    APP1 --> REDIS_CLUSTER
    APP2 --> REDIS_CLUSTER
    APP3 --> REDIS_CLUSTER
    
    WORKER1 --> REDIS_CLUSTER
    WORKER2 --> REDIS_CLUSTER
    
    DB_MASTER --> DB_REPLICA
    
    APP1 --> PROMETHEUS
    APP2 --> PROMETHEUS
    APP3 --> PROMETHEUS
    
    PROMETHEUS --> GRAFANA
    PROMETHEUS --> ALERTS
```

## Integration Patterns

### Synchronous Operations
- Device registration
- Real-time sales validation
- Status checks
- Health monitoring

### Asynchronous Operations
- Failed transaction retries
- Bulk data synchronization
- Report generation
- System maintenance tasks

### Event-Driven Architecture
- Transaction events
- Device status changes
- Error notifications
- Audit trail updates
