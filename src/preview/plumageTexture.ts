import * as T from 'three'
/** Original-art-inspired four-quadrant albedo atlas, applied to real curved geometry. */
export function createPlumageTexture(){
 const texture=new T.TextureLoader().load(`${import.meta.env.BASE_URL}images/xiaobu-plumage-atlas-v3.webp`)
 texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;texture.userData.mimeType='image/jpeg'
 return texture
}
