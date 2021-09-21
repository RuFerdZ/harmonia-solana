import * as borsh from 'borsh';
import { PublicKey } from '@solana/web3.js';

// pub enum MarketplaceInstruction {
//     Hello,
//     CreateProject { name: String },
// }

export enum MarketplaceInstruction {
    Hello, CreateProject
}

// Hook to serialize borsh to rust enum
// https://github.com/near/borsh-js/issues/21
export class CreateProject {
    supply: number;
    constructor(fields: { supply: number } | undefined = undefined) {
        if (fields) {
            this.supply = fields.supply;
        }
    }
}

export const CreateProjectSchema = new Map([[CreateProject, { kind: 'struct', fields: [['supply', 'u32']] }]]);
export const CreateProjectSize = borsh.serialize(CreateProjectSchema, new CreateProject({ supply: 0 })).length;

export class ProjectData {
    initialized: boolean;
    state: number;
    supply: number;
    constructor(fields: {
        state: number,
        supply: number
    } | undefined = undefined) {
        if (fields) {
            this.state = fields.state;
            this.supply = fields.supply;
        }
    }
}
export const ProjectDataSchema = new Map([
    [ProjectData, { kind: 'struct', fields: [['state', 'u8'], ['supply', 'u32']] }],
]);
export const ProjectDataSize = borsh.serialize(ProjectDataSchema, new ProjectData({ state: 0, supply: 0 }),).length;
