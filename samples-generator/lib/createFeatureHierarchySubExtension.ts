import { Gltf, GltfAccessor } from './gltfType';
import {
    FeatureHierarchyClass,
    CompositeAccessorBufferView
} from './featureHierarchyClass';

export type FeatureHierarchyExtIds = { values: number[] };
export type FeatureHierarchyExtValues = {
    values: (number | string | boolean)[];
};
export type FeatureHierarchyExtAccessor = { accessor: number };
export type FeatureHierarchyExtValuesOrAccessor =
    | FeatureHierarchyExtValues
    | FeatureHierarchyExtAccessor;
export type FeatureHierarchyExtIdsOrAccessor =
    | FeatureHierarchyExtIds
    | FeatureHierarchyExtAccessor;

export type FeatureHiearchyExtProperties = {
    [propertyName: string]: FeatureHierarchyExtValuesOrAccessor;
};

export interface BufferViewAccessorState {
    numAccessors: number;
    numBufferViews: number;
    numBuffers: number;
}

/**
 * Differs from [featureHierarchyClass] in that the properties can only
 * be of the form {values: …} or {accessor: …}.
 */
export interface FeatureHierarchyClassExt {
    name: string;
    instanceCount: number;
    properties: FeatureHiearchyExtProperties;
}

export interface FeatureHierarchyExtension {
    classes: FeatureHierarchyClassExt[];
    instanceCount: number;
    classIds: FeatureHierarchyExtIdsOrAccessor;
    parentIds?: FeatureHierarchyExtIdsOrAccessor;
    parentCounts?: FeatureHierarchyExtIdsOrAccessor;
}

/**
 * Add CESIUM_3dtiles_feature_hierarchy as a sub extension to an existing
 * glTF object.
 *
 * @param gltf glTF asset to edit. This glTF asset should already have a
 * `CESIUM_3dtiles_feature_metadata` extension in the extensions member of
 * the glTF asset.
 * @param classes An array of FeatureHierarchyClasses to insert into the glTF
 * asset
 * @param instanceCount
 * @param [parentIds]
 * @param [parentCounts] Optional numerical array containing
 * @throws TypeError If the provided glTF asset does not have a
 * `CESIUM_3dtiles_feature_metadata` extension already.
 * @throws RangeError If classes, parentIds, or parentCounts is empty. Or if
 * instancesLength is <= 0.
 */

export function createFeatureHierarchySubExtension(
    gltf: Gltf,
    classes: FeatureHierarchyClass[],
    classIds: number[] | CompositeAccessorBufferView,
    instanceCount: number,
    parentIds?: number[] | CompositeAccessorBufferView,
    parentCounts?: number[] | CompositeAccessorBufferView,
    binaryData?: Buffer
) {

    assertParametersAreValid(
        classes,
        classIds,
        instanceCount,
        parentIds,
        parentCounts
    );

    if (gltf.extensions?.CESIUM_3dtiles_feature_metadata == null) {
        throw new TypeError(
            'glTF asset is missing CESIUM_3dtiles_feature_metadata!'
        );
    }

    if (binaryData) {
        gltf.buffers.push({
            uri:
                'data:application/octet-stream;base64,' +
                binaryData.toString('base64'),
            byteLength: binaryData.length
        });
    }

    var extension: FeatureHierarchyExtension = {
        classes: featureHierarchyClassToExt(gltf, classes),
        instanceCount: instanceCount,
        classIds: normalizeIdsOrGltfAccessor(gltf, classIds)
    };

    if (parentIds != null) {
        extension.parentIds = normalizeIdsOrGltfAccessor(gltf, parentIds);
    }

    if (parentCounts != null) {
        extension.parentCounts = normalizeIdsOrGltfAccessor(gltf, parentCounts);
    }

    const featureMetadataExtension =
        gltf.extensions.CESIUM_3dtiles_feature_metadata;
    if (featureMetadataExtension.extensions == null) {
        featureMetadataExtension.extensions = {};
        featureMetadataExtension.extensions.CESIUM_3dtiles_feature_hierarchy = extension;
    }
}

/**
 * For each instance in each class, if the instance is a primitive array,
 * leave it as-is, otherwise add a new BufferView / Accessor to the glTF asset
 * and wrap it with the binary data with {accessor: index}
 */

function featureHierarchyClassToExt(
    gltf: Gltf,
    classes: FeatureHierarchyClass[]
): FeatureHierarchyClassExt[] {
    const result: FeatureHierarchyClassExt[] = [];

    for (const cls of classes) {
        let normalizedProperties: FeatureHiearchyExtProperties = {};
        for (const propName in cls.properties) {
            const property = cls.properties[propName];
            if (Array.isArray(property)) {
                normalizedProperties[propName] = { values: property };
            } else {
                createAccessorAndBufferView(gltf, property);
                normalizedProperties[propName] = {
                    accessor: gltf.accessors.length - 1
                };
            }
        }

        result.push({
            name: cls.name,
            properties: normalizedProperties,
            instanceCount: cls.instanceCount
        });
    }

    return result;
}

/**
 * If data is a primitive array, wrap it with {values: primitive} and add it to
 * the provided object, otherwise add a new BufferView / Accessor and wrap the
 * binary data with {accessor: index}
 */

function normalizeValuesOrGltfAccessor(
    gltf: Gltf,
    data: number[] | CompositeAccessorBufferView
): FeatureHierarchyExtValuesOrAccessor {
    if (Array.isArray(data)) {
        return { values: data };
    }

    createAccessorAndBufferView(gltf, data);
    return { accessor: gltf.accessors.length - 1 };
}

function normalizeIdsOrGltfAccessor(
    gltf: Gltf,
    data: number[] | CompositeAccessorBufferView
): FeatureHierarchyExtIdsOrAccessor {
    if (Array.isArray(data)) {
        return { values: data };
    }

    createAccessorAndBufferView(gltf, data);
    return { accessor: gltf.accessors.length - 1 };
}

function createAccessorAndBufferView(
    gltf: Gltf,
    composite: CompositeAccessorBufferView
) {
    gltf.bufferViews.push({
        buffer: gltf.buffers.length - 1,
        byteLength: composite.byteLength,
        byteOffset: composite.byteOffset,
        target: 0x8892
    });

    const bufferViewIndex = gltf.bufferViews.length - 1;
    gltf.accessors.push({
        bufferView: bufferViewIndex,
        byteOffset: 0,
        componentType: composite.componentType,
        count: composite.count,
        min: composite.min,
        max: composite.max,
        type: composite.type
    });
}

function assertParametersAreValid(
    classes: FeatureHierarchyClass[],
    classIds: number[] | GltfAccessor,
    instanceCount: number,
    parentIds?: number[] | GltfAccessor,
    parentCounts?: number[] | GltfAccessor
) {
    if (classes.length === 0) {
        throw new RangeError(
            `Classes array is empty, should contain at least one element`
        );
    }

    if (Array.isArray(classIds) && classIds.length === 0) {
        throw new RangeError(
            `Classes array is empty, should contain at least one element`
        );
    }

    if (instanceCount <= 0) {
        throw new RangeError('instanceCount must be positive');
    }

    if (Array.isArray(parentIds) && parentIds?.length === 0) {
        throw new RangeError(
            'Empty parentIds array provided, should contain at least one' +
                'parentId'
        );
    }

    if (Array.isArray(parentCounts) && parentCounts?.length === 0) {
        throw new RangeError(
            'Empty parentCounts provided, should contain at least one parentId'
        );
    }
}
