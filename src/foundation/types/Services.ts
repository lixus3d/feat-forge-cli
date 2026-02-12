import { Type } from 'class-transformer';
import { IsString, IsEnum, IsOptional, IsNumber, IsObject, ValidateNested, Min, Max, IsArray } from 'class-validator';
import { RepoName } from './RepositoryInfos';

/**
 * Service definition from .forge/services.json (without port)
 */
export class ServiceDefinition {
    @IsString()
    name!: string;

    @IsOptional()
    @IsEnum(['http', 'tcp', 'grpc'])
    type: 'http' | 'tcp' | 'grpc' = 'http'; // Phase 1: HTTP only, but extensible

    @IsOptional()
    @IsString()
    path?: string; // HTTP only, e.g., "/api"
}

/**
 * Service with assigned port (in generated.services.json)
 */
export class GeneratedService extends ServiceDefinition {
    @IsNumber()
    @Min(1024)
    @Max(65535)
    port!: number;
}

/**
 * Services declaration from .forge/services.json
 */
export class ServicesFile {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ServiceDefinition)
    services!: ServiceDefinition[];
}

/**
 * Services for a single repository
 */
export class RepositoryServices {
    @ValidateNested({ each: true })
    @Type(() => GeneratedService)
    services!: GeneratedService[];
}

/**
 * All repositories' services in a branch
 */
export class GeneratedServicesFile {
    @IsString()
    _doNotEdit!: string;

    @IsString()
    generatedAt!: string;

    repos!: Record<string, RepositoryServices>;
}

/**
 * Port allocation for a single branch
 */
export class BranchPortAllocation {
    @IsNumber()
    @Min(1024)
    start!: number;

    @IsNumber()
    @Max(65535)
    end!: number;

    @IsNumber()
    @Min(1024)
    usedUntil!: number; // Highest port assigned + 1

    @IsOptional()
    @IsObject()
    services?: Record<string, number>; // Maps service name to its allocated port
}

/**
 * Root port allocations file structure
 */
export class PortAllocationsFile {
    @IsString()
    _doNotEdit!: string;

    @IsNumber()
    @Min(1024)
    servicesBasePort!: number;

    @IsNumber()
    @Min(1)
    branchRangeSize!: number;

    @IsObject()
    allocations!: Record<string, BranchPortAllocation>;
}

/** Maps a repository name to its list of service definitions */
export type RepoServices = Record<RepoName, ServiceDefinition[]>;

/**
 * Result from scanning repositories for services
 */
export class ScanResult {
    @IsObject()
    @Type(() => ServiceDefinition)
    repos!: RepoServices;
}
