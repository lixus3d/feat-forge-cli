import { Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { RepoName } from './RepositoryInfos';
import { ServiceName } from '../PortAllocator';
import { BranchName } from '../BranchContext';
import { T } from 'node_modules/vitest/dist/chunks/traces.d.402V_yFI';

/**
 * Service definition from .forge/services.json (without port)
 */
export class ServiceDefinition {
    @IsString()
    name!: ServiceName;

    @IsOptional()
    @IsEnum(['http', 'tcp', 'grpc'])
    type: 'http' | 'tcp' | 'grpc' = 'http'; // Phase 1: HTTP only, but extensible

    @IsOptional()
    @IsString()
    path?: string; // HTTP only, e.g., "/api"
}

/**
 * Services declaration from .forge/services.json
 */
export class ServicesDTO {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ServiceDefinition)
    services!: ServiceDefinition[];
}

/**
 * Services for a single repository
 */
export class RepositoryServices {
    /**
     * Repository name
     */
    @IsString()
    @IsNotEmpty()
    name!: RepoName;

    @ValidateNested({ each: true })
    @Type(() => ServiceDefinition)
    services!: ServiceDefinition[];
}

/**
 * Service with assigned port (in generated.services.json)
 */
export class ServiceDefinitionWithPort extends ServiceDefinition {
    @IsNumber()
    @Min(1024)
    @Max(65535)
    port!: number;
}

/**
 * All repositories' services in a branch
 */
export class GeneratedServicesDTO {
    @IsString()
    _doNotEdit!: string;

    @IsDate()
    @Type(() => Date)
    generatedAt!: Date;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ServiceDefinitionWithPort)
    services!: ServiceDefinitionWithPort[];
}

/**
 * Root port allocations file structure
 */
export class PortAllocatorDTO {
    @IsString()
    _doNotEdit!: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BranchPortAllocationDTO)
    allocations!: BranchPortAllocationDTO[];
}

export class BranchPortAllocationDTO {
    /**
     * Branch name
     */
    @IsString()
    @IsNotEmpty()
    name!: BranchName;

    /**
     * Starting port number for this branch's allocation range
     */
    @IsNumber()
    @Min(1024)
    start!: number;

    /**
     * Ending port number for this branch's allocation range
     */
    @IsNumber()
    @Max(65535)
    end!: number;

    /**
     * Services with their allocated ports for this branch
     */
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ServiceDefinitionWithPort)
    services!: ServiceDefinitionWithPort[]; // Maps service name to its allocated port
}
