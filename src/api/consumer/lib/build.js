/** @flow */
import { loadConsumer, Consumer } from '../../../consumer';
import Component from '../../../consumer/component';
import { BitId } from '../../../bit-id';
import BitMap from '../../../consumer/bit-map';
import ComponentsList from '../../../consumer/component/components-list';
import ComponentWithDependencies from '../../../scope/component-dependencies';
import { writeDependencyLinks, writeEntryPointsForImportedComponent } from '../../../consumer/component/link-generator';
import { COMPONENT_ORIGINS } from '../../../constants';
import { pathNormalizeToLinux } from '../../../utils/path';

async function writeDistFiles(component: Component, consumer: Consumer, bitMap: BitMap): Promise<?Array<?string>> {
  const componentMap = bitMap.getComponent(component.id);
  component.updateDistsPerConsumerBitJson(consumer, componentMap);
  const saveDist = component.dists.map(distFile => distFile.write());
  const distsFiles = await Promise.all(saveDist);
  if (componentMap.origin === COMPONENT_ORIGINS.IMPORTED) {
    await writeLinksInDist(consumer, component, componentMap, bitMap);
  }
  return distsFiles;
}

async function writeLinksInDist(consumer: Consumer, component: Component, componentMap, bitMap: BitMap) {
  const getDependencies = () => {
    return component.dependencies.map((dependency) => {
      if (bitMap.isExistWithSameVersion(dependency.id)) {
        return consumer.loadComponent(dependency.id);
      }
      // when dependencies are imported as npm packages, they are not in bit.map
      component.dependenciesSavedAsComponents = false;
      return consumer.scope.loadComponent(dependency.id, false);
    });
  };
  const dependencies = await Promise.all(getDependencies());
  const componentWithDeps = new ComponentWithDependencies({ component, dependencies });
  await writeDependencyLinks([componentWithDeps], bitMap, consumer, false);
  const newMainFile = pathNormalizeToLinux(component.calculateMainDistFile());
  await component.updatePackageJsonAttribute(consumer, componentMap.rootDir, 'main', newMainFile);
  return writeEntryPointsForImportedComponent(component, bitMap, consumer);
}

export async function build(id: string): Promise<?Array<string>> {
  const bitId = BitId.parse(id);
  const consumer = await loadConsumer();
  const bitMap = await BitMap.load(consumer.getPath());
  const component: Component = await consumer.loadComponent(bitId);
  const result = await component.build({ scope: consumer.scope, consumer, bitMap });
  if (result === null) return null;
  const distFilePaths = await writeDistFiles(component, consumer, bitMap);
  bitMap.addMainDistFileToComponent(component.id, distFilePaths);
  await bitMap.write();
  // await consumer.driver.runHook('onBuild', [component]);
  return distFilePaths;
}

async function buildAllResults(components, consumer, bitMap) {
  return components.map(async (component) => {
    const result = await component.build({ scope: consumer.scope, consumer, bitMap });
    const bitId = new BitId({ box: component.box, name: component.name });
    if (result === null) {
      return { component: bitId.toString(), buildResults: null };
    }
    const buildResults = await writeDistFiles(component, consumer, bitMap);
    return { component: bitId.toString(), buildResults };
  });
}

export async function buildAll(): Promise<Object> {
  const consumer = await loadConsumer();
  const bitMap = await BitMap.load(consumer.getPath());
  const componentsList = new ComponentsList(consumer);
  const newAndModifiedComponents = await componentsList.newAndModifiedComponents();
  if (!newAndModifiedComponents || !newAndModifiedComponents.length) return Promise.reject('nothing to build');
  const buildAllP = await buildAllResults(newAndModifiedComponents, consumer, bitMap);
  const allComponents = await Promise.all(buildAllP);
  const componentsObj = {};
  allComponents.forEach((component) => {
    componentsObj[component.component] = component.buildResults;
  });
  await bitMap.write();
  // await consumer.driver.runHook('onBuild', allComponents);
  return componentsObj;
}
