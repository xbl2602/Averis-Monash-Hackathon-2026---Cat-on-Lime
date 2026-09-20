/**
 * 引擎逻辑版本号（叶子模块：只放常量，不 import 任何东西）。
 *
 * 为什么单独一个文件：结果层（pipeline/verification-store）和导出层都要用它，
 * 但导出函数不应该为了一个字符串把整个 pipeline（连带附件解析重依赖）拖进函数包。
 * 改规则的实质改动时在这里手动 +1（原位置：lib/shared/pipeline.ts 的注释）。
 */
export const PIPELINE_LOGIC_VERSION = "v4-2026-09-20";
