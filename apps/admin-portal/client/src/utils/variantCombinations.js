function generateTempId() {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/** Generate all variant combinations from option groups (Size, Flavor, etc.). */
export function generateCombinations(options) {
  if (!options || options.length === 0) return [];
  const validOptions = options.filter((opt) => opt.name && opt.values?.length > 0);
  if (validOptions.length === 0) return [];

  const results = [];
  function helper(index, currentAttributes, currentName) {
    if (index === validOptions.length) {
      results.push({
        _id: generateTempId(),
        name: currentName,
        attributes: currentAttributes,
        price: '',
        description: '',
        images: [],
        available: true,
      });
      return;
    }
    const option = validOptions[index];
    for (const val of option.values) {
      helper(
        index + 1,
        [...currentAttributes, { name: option.name, value: val }],
        currentName ? `${currentName} / ${val}` : val,
      );
    }
  }
  helper(0, [], '');
  return results;
}

/** Rebuild variant list when option groups change, preserving prices and metadata. */
export function rebuildVariants(newOptions, currentVariants) {
  const generated = generateCombinations(newOptions);
  return generated.map((gen) => {
    const match = currentVariants.find((v) => {
      if (v.attributes?.length !== gen.attributes.length) return false;
      return gen.attributes.every((genAttr) =>
        v.attributes.some(
          (vAttr) => vAttr.name === genAttr.name && vAttr.value === genAttr.value,
        ),
      );
    });
    if (match) {
      return {
        ...gen,
        _id: match._id,
        price: match.price,
        description: match.description,
        images: match.images || [],
        image: match.image || '',
        imageKey: match.imageKey || '',
        available: match.available !== false,
      };
    }
    return gen;
  });
}

export function findVariantIndex(variants, size, flavor) {
  return variants.findIndex((v) => {
    const attrs = v.attributes || [];
    const hasSize = size
      ? attrs.some((a) => a.name === 'Size' && a.value === size)
      : !attrs.some((a) => a.name === 'Size');
    const hasFlavor = flavor
      ? attrs.some((a) => a.name === 'Flavor' && a.value === flavor)
      : !attrs.some((a) => a.name === 'Flavor');
    const expectedLen = (size ? 1 : 0) + (flavor ? 1 : 0);
    return hasSize && hasFlavor && attrs.length === expectedLen;
  });
}
