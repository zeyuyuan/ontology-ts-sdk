/*
 * Copyright (C) 2018 The ontology Authors
 * This file is part of The ontology library.
 *
 * The ontology is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * The ontology is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with The ontology.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as elliptic from 'elliptic';
import { StringReader, num2hexstring } from '../utils';
import { Key, KeyParameters } from './Key';
import { Signature } from './Signature';
import { KeyType } from './KeyType';
import { CurveLabel } from './CurveLabel';
import { SignatureSchema } from './SignatureSchema';

export class PublicKey extends Key {
    /**
     * Verifies if the signature was created with private key corresponding to supplied public key
     * and was not tampered with using signature schema.
     * 
     * @param msg Hex encoded input data
     * @param signature Signature object
     */
    verify(msg: string, signature: Signature): boolean {
        if (!this.isSchemaSupported(signature.algorithm)) {
            throw new Error('Signature schema does not match key type.');
        }
        
        const hash = this.computeHash(msg, signature.algorithm);
        return this.verifySignature(hash, signature.value, signature.algorithm);
    }

    /**
     * Creates PublicKey from Hex representation.
     * 
     * @param sr String reader
     * @param length Byte length of the serialized object
     * 
     */
    static deserializeHex(sr: StringReader, length: number = 35): PublicKey {
        const algorithmHex = parseInt(sr.read(1), 16);
		const curveHex = parseInt(sr.read(1), 16);
		const pk = sr.read(length - 2);
        
        return new PublicKey(
            pk,
            KeyType.fromHex(algorithmHex),
            new KeyParameters(CurveLabel.fromHex(curveHex))
        );
    }

    /**
     * Serializes public key to Hex representation. 
     * 
     * Length definition is not included.
     */
    serializeHex(): string {
        let result = '';
        result += num2hexstring(this.algorithm.hex);
        result += num2hexstring(this.parameters.curve.hex);
        result += this.key;
        return result;
    }

    verifySignature(hash: string, signature: string, schema: SignatureSchema): boolean {
        switch(schema) {
            case SignatureSchema.ECDSAwithSHA224:
            case SignatureSchema.ECDSAwithSHA256:
            case SignatureSchema.ECDSAwithSHA384:
            case SignatureSchema.ECDSAwithSHA512:
            case SignatureSchema.ECDSAwithSHA3_224:
            case SignatureSchema.ECDSAwithSHA3_256:
            case SignatureSchema.ECDSAwithSHA3_384:
            case SignatureSchema.ECDSAwithSHA3_512:
            case SignatureSchema.ECDSAwithRIPEMD160:
                return this.verifiyEcDSASignature(hash, signature);
            case SignatureSchema.EDDSAwithSHA512:
                return this.verifiyEdDSASignature(hash, signature);
            case SignatureSchema.SM2withSM3:
            default:
                throw new Error('Unsupported signature schema.');
        }
    }

    /**
     * Verifies EcDSA signature of message hash. Curve name is derrived from private key.
     * 
     * @param hash Message hash
     * @param signature Hex encoded signature
     */
    verifiyEcDSASignature(hash: string, signature: string): boolean {
        const r = signature.substr(0, 64);
        const s = signature.substr(64, 64);

        const ec = new elliptic.ec(this.parameters.curve.preset);
        return ec.verify(hash, { r, s }, this.key, 'hex');
    }

    /**
     * Verifies EdDSA signature of message hash. Curve name is derrived from private key.
     * 
     * @param hash Message hash
     * @param signature Hex encoded signature
     */
    verifiyEdDSASignature(hash: string, signature: string): boolean {
        const r = signature.substr(0, 64);
        const s = signature.substr(64, 64);

        const eddsa = new elliptic.eddsa(this.parameters.curve.preset);
        return eddsa.verify(hash, { r, s }, this.key, 'hex');
    }
};

/**
 * Public key status enumaration.
 */
export enum PK_STATUS  {
	IN_USE = '01',
	REVOKED = '00'
};

/**
 * Pair of public key and its status.
 */
export class PublicKeyStatus {
	pk: PublicKey;
    status: string;
    
    constructor(pk: PublicKey, status: string) {
        this.pk = pk;
        this.status = status;
    }

	static deserialize(hexstr: string) : PublicKeyStatus {
		const sr = new StringReader(hexstr);
		const status = sr.read(1);
        const publicKey = PublicKey.deserializeHex(sr);

		return new PublicKeyStatus(publicKey, status);
	}
};
