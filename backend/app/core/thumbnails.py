"""
Génération de miniatures produit côté serveur.

Les images produit sont stockées en base sous forme de data-URI base64
(voir Product.images) — aucun stockage objet externe n'est configuré.
Renvoyer ces images pleine résolution dans une liste de plusieurs
centaines de produits gonfle la réponse à plusieurs dizaines de Mo, au
point de rendre le catalogue et l'historique des ventes tout simplement
injoignables sur une connexion normale. Product.thumbnail stocke une
version compressée (~150px, JPEG qualité modérée) dérivée de images[0],
utilisée par les listes/grilles ; les vues détail/édition continuent de
charger l'image pleine résolution à la demande (GET /products/{id}).
"""
import base64
import io
import logging

from PIL import Image

logger = logging.getLogger(__name__)

THUMBNAIL_MAX_SIZE = (150, 150)
THUMBNAIL_QUALITY = 60


def generate_thumbnail(data_uri: str | None) -> str | None:
    """Dérive une miniature JPEG compressée d'un data-URI image.

    Retourne None si l'entrée est vide ou n'est pas une image décodable
    (mieux vaut un catalogue sans miniature que casser la création d'un
    produit sur une image malformée)."""
    if not data_uri:
        return None
    try:
        header, _, encoded = data_uri.partition(",")
        if not encoded:
            return None
        raw = base64.b64decode(encoded)
        img = Image.open(io.BytesIO(raw))
        img = img.convert("RGB")
        img.thumbnail(THUMBNAIL_MAX_SIZE)
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=THUMBNAIL_QUALITY, optimize=True)
        thumb_b64 = base64.b64encode(buffer.getvalue()).decode("ascii")
        return f"data:image/jpeg;base64,{thumb_b64}"
    except Exception as e:
        logger.warning("Échec de génération de miniature : %s", e)
        return None
